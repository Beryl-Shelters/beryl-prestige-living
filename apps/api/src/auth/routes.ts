import { timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { AuthConfig } from "./config.js";
import { hashToken, randomToken } from "./crypto.js";
import { AuthError, expired, invalidCode } from "./errors.js";
import type { AuthGateway } from "./gateway.js";
import { AuthSessions } from "./sessions.js";
import { codeSchema, identifierSchema, loginSchema, maskEmail, normalizeIdentifier, normalizePhone, registerSchema, resetSchema } from "./validation.js";

const genericRecovery = { message: "If an account matches those details, a verification code will be sent to its email." };
const wrap = (handler: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response, next: NextFunction) => { void handler(request, response).catch(next); };

export function authRouter(config: AuthConfig, gateway: AuthGateway) {
  const router = Router();
  const sessions = new AuthSessions(config, gateway);
  router.use((_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
  // Exact origin and JSON content type defend cookie-authenticated mutations
  // against cross-site and malicious sibling-subdomain requests.
  router.use((request, _response, next) => {
    if (request.method !== "GET" && (request.headers.origin !== config.webOrigin || !request.is("application/json"))) {
      next(new AuthError(403, "UNTRUSTED_ORIGIN", "This request is not permitted.")); return;
    }
    next();
  });
  const limiter = rateLimit({ windowMs: config.rateWindowMs, limit: config.rateLimit, standardHeaders: "draft-7", legacyHeaders: false,
    message: { success: false, error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } },
    skip: (request) => request.method === "GET" || request.path === "/logout",
  });
  router.use(limiter);

  async function resolve(identifier: string) {
    let lookup;
    try { lookup = normalizeIdentifier(identifier); } catch { return null; }
    return gateway.findCustomer(lookup.column, lookup.value);
  }
  function ok(response: Response, data: unknown = {}) { response.json({ success: true, data }); }

  router.post("/register", wrap(async (request, response) => {
    const data = registerSchema.parse(request.body);
    const phone = normalizePhone(data.phoneNumber, data.countryCode);
    const [emailUsed, phoneUsed] = await Promise.all([gateway.findCustomer("email", data.email), gateway.findCustomer("phone_number_normalized", phone)]);
    // One duplicate message does not reveal which internal identity matched.
    if (emailUsed || phoneUsed) throw new AuthError(409, "ACCOUNT_EXISTS", "An account already uses those details. Log in or recover your password.");
    try { await gateway.signup(data, phone); }
    catch (error) {
      // A concurrent signup can win after the preflight checks; the database
      // unique constraints remain authoritative, including trigger rollbacks.
      if (error instanceof AuthError && error.code === "AUTH_UNAVAILABLE") {
        const [existingEmail, existingPhone] = await Promise.all([gateway.findCustomer("email", data.email), gateway.findCustomer("phone_number_normalized", phone)]);
        if (existingEmail || existingPhone) throw new AuthError(409, "ACCOUNT_EXISTS", "An account already uses those details. Log in or recover your password.");
      }
      throw error;
    }
    sessions.setChallenge(response, "VERIFY", { email: data.email });
    response.status(201);
    ok(response, { maskedEmail: maskEmail(data.email) });
  }));
  router.post("/login", wrap(async (request, response) => {
    const data = loginSchema.parse(request.body);
    const profile = await resolve(data.identifier);
    // Execute a password request even for unknown phones to reduce obvious timing differences.
    const email = profile?.email ?? (data.identifier.includes("@") ? data.identifier.trim().toLowerCase() : `${randomToken()}@invalid.example`);
    try {
      const tokens = await gateway.login(email, data.password);
      if (!profile || tokens.userId !== profile.id) throw new AuthError(401, "INVALID_CREDENTIALS", "Invalid credentials.");
      await sessions.establish(request, response, "ACCOUNT", tokens);
      sessions.clear(response, "VERIFY");
      ok(response);
    } catch (error) {
      if (error instanceof AuthError && error.code === "EMAIL_NOT_VERIFIED") {
        sessions.setChallenge(response, "VERIFY", { email });
      }
      throw error;
    }
  }));
  router.get("/verification-context", wrap(async (request, response) => {
    const email = sessions.challenge(request, "VERIFY")?.email;
    if (!email) throw new AuthError(400, "VERIFICATION_REQUIRED", "Enter your email on the login page and choose Verify Email.");
    ok(response, { maskedEmail: maskEmail(email) });
  }));
  router.post("/verify-email", wrap(async (request, response) => {
    const { code } = codeSchema.parse(request.body);
    const email = sessions.challenge(request, "VERIFY")?.email;
    if (!email) throw invalidCode();
    const tokens = await gateway.verify(email, code, "signup");
    await sessions.establish(request, response, "ACCOUNT", tokens);
    sessions.clear(response, "VERIFY");
    ok(response);
  }));
  router.post("/resend-verification", wrap(async (request, response) => {
    const body = z.object({ identifier: z.string().trim().min(1).max(254).optional() }).strict().parse(request.body);
    const profile = body.identifier ? await resolve(body.identifier) : null;
    const email = body.identifier ? profile?.email ?? (body.identifier.includes("@") ? body.identifier.toLowerCase() : `${randomToken()}@invalid.example`) : sessions.challenge(request, "VERIFY")?.email;
    if (!email) throw new AuthError(400, "VERIFICATION_REQUIRED", "Enter your email on the login page and choose Verify Email.");
    await gateway.resend(email);
    sessions.setChallenge(response, "VERIFY", { email });
    ok(response, { message: "If verification is needed, a code has been sent to your account email." });
  }));
  router.get("/me", wrap(async (request, response) => {
    const tokens = await sessions.account(request);
    const profile = await gateway.findCustomer("id", tokens.userId);
    if (!profile?.email_verified_at) throw expired();
    ok(response, { customer: profile });
  }));
  router.post("/logout", wrap(async (request, response) => { await sessions.logout(request, response); ok(response); }));

  async function sendRecovery(identifier: string) {
    const profile = await resolve(identifier);
    // Never expose provider delivery/unknown-user differences in this initiation response.
    try { await gateway.recover(profile?.email ?? `${randomToken()}@invalid.example`); }
    catch { console.warn(JSON.stringify({ event: "recovery_delivery_unconfirmed" })); }
  }
  router.post("/forgot-password", wrap(async (request, response) => {
    const { identifier } = identifierSchema.parse(request.body);
    const oldGrant = sessions.cookie(request, "RECOVERY");
    if (oldGrant) await gateway.deleteSession(hashToken(oldGrant));
    await sendRecovery(identifier);
    sessions.setChallenge(response, "FORGOT", { identifier });
    sessions.clear(response, "RECOVERY");
    ok(response, genericRecovery);
  }));
  router.post("/resend-recovery", wrap(async (request, response) => {
    const identifier = sessions.challenge(request, "FORGOT")?.identifier;
    if (!identifier) throw invalidCode();
    await sendRecovery(identifier);
    sessions.setChallenge(response, "FORGOT", { identifier });
    ok(response, genericRecovery);
  }));
  router.post("/verify-recovery", wrap(async (request, response) => {
    const { code } = codeSchema.parse(request.body);
    const identifier = sessions.challenge(request, "FORGOT")?.identifier;
    if (!identifier) throw invalidCode();
    const profile = await resolve(identifier);
    const tokens = await gateway.verify(profile?.email ?? `${randomToken()}@invalid.example`, code, "recovery");
    if (!profile || profile.id !== tokens.userId) throw invalidCode();
    await sessions.establish(request, response, "RECOVERY", tokens);
    sessions.clear(response, "FORGOT");
    ok(response);
  }));
  router.get("/recovery-context", wrap(async (request, response) => {
    const raw = sessions.cookie(request, "RECOVERY");
    if (!raw || !await gateway.readSession(hashToken(raw), "RECOVERY")) throw expired();
    ok(response);
  }));
  router.post("/reset-password", wrap(async (request, response) => {
    const { password } = resetSchema.parse(request.body);
    const raw = sessions.cookie(request, "RECOVERY");
    if (!raw) throw expired();
    const record = await gateway.consumeRecovery(hashToken(raw));
    sessions.clear(response, "RECOVERY");
    if (!record) throw expired();
    const tokens = sessions.decode(record);
    await gateway.validate(tokens);
    // Invalidate application sessions before the provider mutation (fail closed).
    await gateway.deleteUserSessions(record.user_id);
    await gateway.updatePassword(tokens, password);
    await gateway.deleteUserSessions(record.user_id);
    await gateway.signOut(tokens);
    sessions.clear(response, "ACCOUNT");
    ok(response);
  }));

  router.post("/google", wrap(async (_request, response) => {
    if (!config.googleEnabled) throw new AuthError(503, "GOOGLE_NOT_CONFIGURED", config.production ? "Google sign-in is not available yet." : "Google OAuth is not configured. Configure the Supabase Google provider and callback URLs, then enable AUTH_GOOGLE_ENABLED.");
    const state = randomToken();
    const { url, verifier } = await gateway.startGoogle(state);
    sessions.setChallenge(response, "OAUTH", { state, verifier }, 600);
    ok(response, { url });
  }));
  router.post("/google/callback", wrap(async (request, response) => {
    if (!config.googleEnabled) throw new AuthError(503, "GOOGLE_NOT_CONFIGURED", "Google sign-in is not available yet.");
    const data = z.object({ code: z.string().min(1).max(2048), state: z.string().min(1).max(128) }).strict().parse(request.body);
    const flow = sessions.challenge(request, "OAUTH");
    sessions.clear(response, "OAUTH");
    if (!flow?.state || !flow.verifier || !timingSafeEqual(Buffer.from(hashToken(flow.state)), Buffer.from(hashToken(data.state)))) throw new AuthError(400, "OAUTH_STATE_INVALID", "Google sign-in expired. Please try again.");
    const tokens = await gateway.exchangeGoogle(data.code, flow.verifier);
    const profile = await gateway.findCustomer("id", tokens.userId);
    if (!profile?.email_verified_at) throw expired();
    await sessions.establish(request, response, "ACCOUNT", tokens);
    ok(response);
  }));
  return router;
}
