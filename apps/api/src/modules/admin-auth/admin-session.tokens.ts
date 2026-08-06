import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ADMIN_AUDIENCE = "beryl-admin";

type BaseClaims = {
  sub: string;
  sid: string;
  aud: typeof ADMIN_AUDIENCE;
  iat: number;
  exp: number;
  role: "ADMIN" | "SUPER_ADMIN";
  department: "TECH" | "MANAGEMENT";
};

export type AdminAccessClaims = BaseClaims & { typ: "admin_access"; ver: number; restricted: boolean };
export type AdminRefreshClaims = BaseClaims & { typ: "admin_refresh"; jti: string; ver: number; restricted: boolean };

export class AdminTokenError extends Error {
  constructor(readonly reason: "INVALID" | "EXPIRED") { super(`Admin token ${reason.toLowerCase()}`); }
}

const encode = (value: unknown) => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
const signature = (secret: string, value: string) => createHmac("sha256", secret).update(value, "utf8").digest("base64url");
const sign = (secret: string, claims: AdminAccessClaims | AdminRefreshClaims) => {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode(claims);
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${signature(secret, unsigned)}`;
};

const verify = <T extends AdminAccessClaims | AdminRefreshClaims>(token: string, secret: string, expectedType: T["typ"], now: Date) => {
  const parts = token.split(".");
  if (parts.length !== 3 || secret.length < 32) throw new AdminTokenError("INVALID");
  const expected = Buffer.from(signature(secret, `${parts[0]}.${parts[1]}`), "utf8");
  const supplied = Buffer.from(parts[2], "utf8");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new AdminTokenError("INVALID");
  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as T;
    if (header.alg !== "HS256" || header.typ !== "JWT" || claims.aud !== ADMIN_AUDIENCE || claims.typ !== expectedType || typeof claims.sub !== "string" || typeof claims.sid !== "string" || !Number.isInteger(claims.ver) || typeof claims.restricted !== "boolean" || !["ADMIN", "SUPER_ADMIN"].includes(claims.role) || !["TECH", "MANAGEMENT"].includes(claims.department) || claims.exp <= Math.floor(now.getTime() / 1_000)) throw new AdminTokenError(claims.exp <= Math.floor(now.getTime() / 1_000) ? "EXPIRED" : "INVALID");
    return claims;
  } catch (error) { if (error instanceof AdminTokenError) throw error; throw new AdminTokenError("INVALID"); }
};

type IssueInput = { secret: string; adminId: string; sessionId: string; sessionVersion: number; role: "ADMIN" | "SUPER_ADMIN"; department: "TECH" | "MANAGEMENT"; restricted: boolean; expiresIn: number; now: Date };
export const issueAdminAccessToken = (input: IssueInput) => {
  const iat = Math.floor(input.now.getTime() / 1_000);
  return sign(input.secret, { sub: input.adminId, sid: input.sessionId, ver: input.sessionVersion, role: input.role, department: input.department, restricted: input.restricted, aud: ADMIN_AUDIENCE, typ: "admin_access", iat, exp: iat + input.expiresIn });
};
export const issueAdminRefreshToken = (input: IssueInput) => {
  const iat = Math.floor(input.now.getTime() / 1_000);
  return sign(input.secret, { sub: input.adminId, sid: input.sessionId, ver: input.sessionVersion, role: input.role, department: input.department, restricted: input.restricted, jti: randomBytes(32).toString("base64url"), aud: ADMIN_AUDIENCE, typ: "admin_refresh", iat, exp: iat + input.expiresIn });
};
export const verifyAdminAccessToken = (token: string, secret: string, now = new Date()) => verify<AdminAccessClaims>(token, secret, "admin_access", now);
export const verifyAdminRefreshToken = (token: string, secret: string, now = new Date()) => {
  const claims = verify<AdminRefreshClaims>(token, secret, "admin_refresh", now);
  if (typeof claims.jti !== "string" || claims.jti.length < 32) throw new AdminTokenError("INVALID");
  return claims;
};
export const hashAdminSecret = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
export const hashAdminInvitationToken = (secret: string, value: string) => createHmac("sha256", secret).update(value, "utf8").digest("hex");
export const createAdminProof = () => randomBytes(32).toString("base64url");
