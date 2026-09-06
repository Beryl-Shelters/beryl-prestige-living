import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { AuthConfig } from "./config.js";
import { AuthError, expired, invalidCode, unavailable } from "./errors.js";
import type { Registration } from "./validation.js";

export type Customer = {
  id: string; first_name: string | null; last_name: string | null; email: string;
  country_code: string | null; phone_number: string | null; phone_number_normalized: string | null;
  account_type: string | null; profile_type: string | null; email_verified_at: string | null;
};
export type ProviderTokens = { accessToken: string; refreshToken: string; expiresAt: number; userId: string };
export type StoredSession = { token_hash: string; user_id: string; purpose: "ACCOUNT" | "RECOVERY"; encrypted_tokens: string; expires_at: string; refresh_lock: string | null };

export interface AuthGateway {
  findCustomer(column: "email" | "phone_number_normalized" | "id", value: string): Promise<Customer | null>;
  signup(data: Registration, phone: string): Promise<void>;
  login(email: string, password: string): Promise<ProviderTokens>;
  verify(email: string, code: string, type: "signup" | "recovery"): Promise<ProviderTokens>;
  resend(email: string): Promise<void>;
  recover(email: string): Promise<void>;
  validate(tokens: ProviderTokens): Promise<void>;
  refresh(tokens: ProviderTokens): Promise<ProviderTokens>;
  updatePassword(tokens: ProviderTokens, password: string): Promise<void>;
  signOut(tokens: ProviderTokens): Promise<void>;
  createSession(hash: string, userId: string, purpose: "ACCOUNT" | "RECOVERY", encrypted: string, seconds: number): Promise<void>;
  readSession(hash: string, purpose: "ACCOUNT" | "RECOVERY"): Promise<StoredSession | null>;
  claimRefresh(hash: string, lock: string): Promise<StoredSession | null>;
  finishRefresh(hash: string, lock: string, encrypted: string): Promise<boolean>;
  consumeRecovery(hash: string): Promise<StoredSession | null>;
  deleteSession(hash: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;
  startGoogle(state: string): Promise<{ url: string; verifier: string }>;
  exchangeGoogle(code: string, verifier: string): Promise<ProviderTokens>;
}

function providerFailure(error: { code?: string | undefined; status?: number | undefined } | null, fallback: AuthError): void {
  if (!error) return;
  if (error.status === 429) throw new AuthError(429, "RATE_LIMITED", "Too many requests. Please wait before trying again.");
  if (error.code === "email_not_confirmed") throw new AuthError(403, "EMAIL_NOT_VERIFIED", "Verify your email before logging in.");
  if (error.code === "weak_password") throw new AuthError(400, "WEAK_PASSWORD", "Choose a stronger password with at least 12 characters.");
  if (error.code === "same_password") throw new AuthError(400, "SAME_PASSWORD", "Choose a password different from your current password.");
  if (error.code === "user_already_exists" || error.code === "email_exists") throw new AuthError(409, "ACCOUNT_EXISTS", "An account already uses those details. Log in or recover your password.");
  if (error.status && error.status >= 500) throw unavailable();
  throw fallback;
}

function tokens(session: Session | null): ProviderTokens {
  if (!session?.user.email_confirmed_at || !session.expires_at) throw expired();
  return { accessToken: session.access_token, refreshToken: session.refresh_token, expiresAt: session.expires_at, userId: session.user.id };
}

export class SupabaseAuthGateway implements AuthGateway {
  private readonly admin: SupabaseClient;
  private readonly providerFetch: typeof fetch;
  constructor(private readonly config: AuthConfig, transport: typeof fetch = fetch) {
    this.providerFetch = (input, init) => transport(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15000) });
    this.admin = createClient(config.supabaseUrl, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: this.providerFetch } });
  }
  private authClient() {
    return createClient(this.config.supabaseUrl, this.config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: this.providerFetch },
    });
  }
  async findCustomer(column: "email" | "phone_number_normalized" | "id", value: string) {
    const { data, error } = await this.admin.from("customer_profiles")
      .select("id,first_name,last_name,email,country_code,phone_number,phone_number_normalized,account_type,profile_type,email_verified_at")
      .eq(column, value).maybeSingle();
    if (error) throw unavailable();
    return data as Customer | null;
  }
  async signup(data: Registration, phone: string) {
    const settings = await this.providerFetch(`${this.config.supabaseUrl}/auth/v1/settings`, { headers: { apikey: this.config.anonKey } });
    if (!settings.ok) throw unavailable();
    const configuration = await settings.json() as { mailer_autoconfirm?: boolean };
    if (configuration.mailer_autoconfirm !== false) throw new AuthError(503, "EMAIL_CONFIRMATION_REQUIRED", "Email verification is not configured. Please contact support.");
    const { data: result, error } = await this.authClient().auth.signUp({ email: data.email, password: data.password, options: { data: {
      first_name: data.firstName, last_name: data.lastName, country_code: data.countryCode,
      phone_number: data.phoneNumber, phone_number_normalized: phone, account_type: data.accountType, profile_type: data.profileType,
    } } });
    providerFailure(error, unavailable());
    if (result.session || result.user?.email_confirmed_at) {
      // Misconfigured Confirm Email must never silently issue an application session.
      throw new AuthError(503, "EMAIL_CONFIRMATION_REQUIRED", "Email verification is not configured. Please contact support.");
    }
    if (!result.user || result.user.identities?.length === 0) throw new AuthError(409, "ACCOUNT_EXISTS", "An account already uses those details. Log in or recover your password.");
  }
  async login(email: string, password: string) {
    const { data, error } = await this.authClient().auth.signInWithPassword({ email, password });
    providerFailure(error, new AuthError(401, "INVALID_CREDENTIALS", "Invalid credentials."));
    return tokens(data.session);
  }
  async verify(email: string, code: string, type: "signup" | "recovery") {
    const { data, error } = await this.authClient().auth.verifyOtp({ email, token: code, type });
    providerFailure(error, invalidCode());
    return tokens(data.session);
  }
  async resend(email: string) {
    const { error } = await this.authClient().auth.resend({ type: "signup", email });
    providerFailure(error, unavailable());
  }
  async recover(email: string) {
    const { error } = await this.authClient().auth.resetPasswordForEmail(email);
    providerFailure(error, unavailable());
  }
  async validate(value: ProviderTokens) {
    const { data, error } = await this.authClient().auth.getUser(value.accessToken);
    if (error?.status && error.status >= 500) throw unavailable();
    if (error || data.user?.id !== value.userId || !data.user.email_confirmed_at) throw expired();
  }
  async refresh(value: ProviderTokens) {
    const { data, error } = await this.authClient().auth.refreshSession({ refresh_token: value.refreshToken });
    providerFailure(error, expired());
    const next = tokens(data.session);
    if (next.userId !== value.userId) throw expired();
    return next;
  }
  async updatePassword(value: ProviderTokens, password: string) {
    // User-scoped Auth request; the service-role password reset API is never used.
    const client = this.authClient();
    const { error: sessionError } = await client.auth.setSession({ access_token: value.accessToken, refresh_token: value.refreshToken });
    providerFailure(sessionError, expired());
    const { error } = await client.auth.updateUser({ password });
    providerFailure(error, unavailable());
  }
  async signOut(value: ProviderTokens) {
    const { error } = await this.admin.auth.admin.signOut(value.accessToken, "global");
    // Application session has already been deleted; expired provider sessions are harmless.
    if (error && ![401,403,404].includes(error.status ?? 0)) throw unavailable();
  }
  async createSession(hash: string, userId: string, purpose: "ACCOUNT" | "RECOVERY", encrypted: string, seconds: number) {
    const { error } = await this.admin.rpc("create_customer_auth_session", { p_hash: hash, p_user_id: userId, p_purpose: purpose, p_tokens: encrypted, p_seconds: seconds });
    if (error) throw unavailable();
  }
  private async sessionRpc(name: string, args: Record<string, string>): Promise<StoredSession | null> {
    const { data, error } = await this.admin.rpc(name, args);
    if (error) throw unavailable();
    return (data as StoredSession[] | null)?.[0] ?? null;
  }
  readSession(hash: string, purpose: "ACCOUNT" | "RECOVERY") { return this.sessionRpc("read_customer_auth_session", { p_hash: hash, p_purpose: purpose }); }
  claimRefresh(hash: string, lock: string) { return this.sessionRpc("claim_customer_auth_refresh", { p_hash: hash, p_lock: lock }); }
  consumeRecovery(hash: string) { return this.sessionRpc("consume_customer_recovery", { p_hash: hash }); }
  async finishRefresh(hash: string, lock: string, encrypted: string) {
    const { data, error } = await this.admin.from("customer_auth_sessions").update({ encrypted_tokens: encrypted, refresh_lock: null, refresh_lock_until: null })
      .eq("token_hash", hash).eq("refresh_lock", lock).select("token_hash");
    if (error) throw unavailable();
    return Boolean(data?.length);
  }
  async deleteSession(hash: string) {
    const { error } = await this.admin.from("customer_auth_sessions").delete().eq("token_hash", hash);
    if (error) throw unavailable();
  }
  async deleteUserSessions(userId: string) {
    const { error } = await this.admin.from("customer_auth_sessions").delete().eq("user_id", userId);
    if (error) throw unavailable();
  }
  private oauthClient(verifier?: string) {
    const storage = new Map<string, string>();
    if (verifier) storage.set("beryl-oauth-code-verifier", verifier);
    const client = createClient(this.config.supabaseUrl, this.config.anonKey, { global: { fetch: this.providerFetch }, auth: {
      flowType: "pkce", storageKey: "beryl-oauth", persistSession: true,
      autoRefreshToken: false, detectSessionInUrl: false,
      storage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); }, removeItem: (key) => { storage.delete(key); } },
    } });
    return { client, storage };
  }
  async startGoogle(state: string) {
    const settings = await this.providerFetch(`${this.config.supabaseUrl}/auth/v1/settings`, { headers: { apikey: this.config.anonKey } });
    if (!settings.ok) throw unavailable();
    const configuration = await settings.json() as { external?: { google?: boolean } };
    if (!configuration.external?.google) throw new AuthError(503, "GOOGLE_NOT_CONFIGURED", "Google sign-in is not configured in Supabase yet.");
    const { client, storage } = this.oauthClient();
    const { data, error } = await client.auth.signInWithOAuth({ provider: "google", options: {
      redirectTo: `${this.config.webOrigin}/auth/callback?state=${encodeURIComponent(state)}`, skipBrowserRedirect: true,
    } });
    providerFailure(error, unavailable());
    const verifier = storage.get("beryl-oauth-code-verifier");
    if (!data.url || !verifier) throw unavailable();
    return { url: data.url, verifier };
  }
  async exchangeGoogle(code: string, verifier: string) {
    const { client } = this.oauthClient(verifier);
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    providerFailure(error, new AuthError(400, "OAUTH_FAILED", "Google sign-in could not be completed. Please try again."));
    if (!data.user?.identities?.some((identity) => identity.provider === "google")) throw expired();
    return tokens(data.session);
  }
}
