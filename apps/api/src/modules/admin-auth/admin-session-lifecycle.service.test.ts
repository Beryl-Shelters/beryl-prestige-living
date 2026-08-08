import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { issueAdminAccessToken, issueAdminRefreshToken, verifyAdminAccessToken } from "./admin-session.tokens";
import { hashAdminPassword } from "./admin-password";
import { AdminAuthService } from "./admin-auth.service";
import { SupabaseAdminAuthStore } from "./supabase-admin-auth.store";
import { issueCustomerRefreshToken } from "../auth-onboarding/customer-session.tokens";

const now = new Date("2026-08-07T12:00:00.000Z");
const secrets = { adminAccess: "a".repeat(40), adminRefresh: "r".repeat(40), customerAccess: "c".repeat(40), customerRefresh: "f".repeat(40) };
const admin = { id: "dbced31d-8d38-4d5f-93f2-56232e347a89", full_name: "Admin User", email: "admin@example.com", phone: null, department: "MANAGEMENT" as const, admin_role: "SUPER_ADMIN" as const, status: "ACTIVE" as const, password_hash: hashAdminPassword("CurrentAdminPassword123!"), requires_password_change: false, session_version: 3, last_login_at: null, created_at: now.toISOString(), updated_at: now.toISOString() };
const token = (sessionId = randomUUID(), expiresIn = 2_592_000) => issueAdminRefreshToken({ secret: secrets.adminRefresh, adminId: admin.id, sessionId, sessionVersion: admin.session_version, role: admin.admin_role, department: admin.department, restricted: false, expiresIn, now });
const serviceFor = (store: Record<string, unknown>, clock = now) => new AdminAuthService(store as unknown as SupabaseAdminAuthStore, {} as never, { otpSecret: "o".repeat(40), invitationTokenSecret: "i".repeat(40), invitationExpiresIn: 86_400, activationOtpExpiryMinutes: 10, activationOtpMaxAttempts: 3, activationOtpResendCooldownSeconds: 60, adminAccessTokenSecret: secrets.adminAccess, adminAccessTokenExpiresIn: 900, adminRefreshTokenSecret: secrets.adminRefresh, adminRefreshTokenExpiresIn: 2_592_000, customerAccessTokenSecret: secrets.customerAccess, customerRefreshTokenSecret: secrets.customerRefresh, adminLoginOtpExpiryMinutes: 10, adminLoginOtpMaxAttempts: 3, adminLoginOtpResendCooldownSeconds: 60, adminPasswordChangeProofExpiresIn: 600, adminActivationUrl: "http://localhost/activate", now: () => clock });
const codeOf = async (operation: Promise<unknown>) => { try { await operation; } catch (error) { return (error as { code: string }).code; } return "OK"; };

describe("Admin refresh, logout, and password lifecycle", () => {
  it("rotates a valid Admin refresh token and stores only hashes", async () => {
    const rotateSession = vi.fn().mockResolvedValue({ result_status: "OK", result_session_version: 3 });
    const current = token(); const result = await serviceFor({ rotateSession }).refresh(current);
    expect(verifyAdminAccessToken(result.accessToken, secrets.adminAccess, now).aud).toBe("beryl-admin");
    expect(result.refreshToken).not.toBe(current);
    expect(rotateSession.mock.calls[0][0].refreshTokenHash).not.toBe(current);
    expect(rotateSession.mock.calls[0][0].replacementRefreshTokenHash).not.toBe(result.refreshToken);
  });
  it("rejects customer, invalid, and expired refresh tokens", async () => {
    const service = serviceFor({ rotateSession: vi.fn() });
    const customer = issueCustomerRefreshToken({ secret: secrets.adminRefresh, userId: admin.id, sessionId: randomUUID(), expiresIn: 900, now });
    expect(await codeOf(service.refresh(customer))).toBe("INVALID_ADMIN_REFRESH_TOKEN");
    expect(await codeOf(service.refresh("not-a-token"))).toBe("INVALID_ADMIN_REFRESH_TOKEN");
    expect(await codeOf(serviceFor({ rotateSession: vi.fn() }, new Date(now.getTime() + 2_000)).refresh(token(randomUUID(), 1)))).toBe("ADMIN_REFRESH_TOKEN_EXPIRED");
  });
  it("maps revoked, replaced/reused, suspended, locked, and required-password states safely", async () => {
    for (const [status, code] of [["REFRESH_TOKEN_REVOKED", "ADMIN_REFRESH_TOKEN_REVOKED"], ["REFRESH_TOKEN_REUSED", "ADMIN_REFRESH_TOKEN_REUSED"], ["ACCOUNT_SUSPENDED", "ADMIN_ACCOUNT_SUSPENDED"], ["ACCOUNT_LOCKED", "ADMIN_ACCOUNT_LOCKED"], ["PASSWORD_CHANGE_REQUIRED", "ADMIN_PASSWORD_CHANGE_REQUIRED"]]) {
      expect(await codeOf(serviceFor({ rotateSession: vi.fn().mockResolvedValue({ result_status: status }) }).refresh(token()))).toBe(code);
    }
  });
  it("binds logout to the authenticated Admin session and revokes it", async () => {
    const sessionId = randomUUID(); const current = token(sessionId); const revokeSession = vi.fn().mockResolvedValue({ result_status: "OK" });
    await expect(serviceFor({ revokeSession }).logout({ adminId: admin.id, sessionId }, current)).resolves.toEqual({ revoked: true });
    expect(revokeSession.mock.calls[0][0].refreshTokenHash).not.toBe(current);
    expect(await codeOf(serviceFor({ revokeSession }).logout({ adminId: admin.id, sessionId: randomUUID() }, current))).toBe("INVALID_ADMIN_REFRESH_TOKEN");
  });
  it("updates the Admin password without issuing tokens and invalidates sessions", async () => {
    const changePassword = vi.fn().mockResolvedValue({ result_status: "OK" });
    const result = await serviceFor({ findAdminById: vi.fn().mockResolvedValue(admin), changePassword }).changePassword(admin.id, "CurrentAdminPassword123!", "NewAdminPassword123!");
    expect(result).toEqual({ sessionsInvalidated: true, nextAction: "ADMIN_LOGIN" });
    expect(changePassword.mock.calls[0][1]).not.toContain("NewAdminPassword123!");
  });
  it("rejects an incorrect or unchanged current password", async () => {
    const store = { findAdminById: vi.fn().mockResolvedValue(admin), changePassword: vi.fn() }; const service = serviceFor(store);
    expect(await codeOf(service.changePassword(admin.id, "wrong", "NewAdminPassword123!"))).toBe("CURRENT_PASSWORD_INCORRECT");
    expect(await codeOf(service.changePassword(admin.id, "CurrentAdminPassword123!", "CurrentAdminPassword123!"))).toBe("NEW_PASSWORD_SAME_AS_CURRENT");
  });
});
