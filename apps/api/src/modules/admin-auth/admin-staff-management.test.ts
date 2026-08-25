import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminMailService } from "../../services/mail.service";
import { inviteAdminSchema } from "../auth-onboarding/admin.validators";
import { AdminAuthService } from "./admin-auth.service";
import { hashAdminPassword, verifyAdminPassword } from "./admin-password";
import { hashAdminInvitationToken, hashAdminSecret } from "./admin-session.tokens";
import type { AdminRecord, SupabaseAdminAuthStore } from "./supabase-admin-auth.store";

const now = new Date("2026-08-25T10:00:00.000Z");
const invitationSecret = "i".repeat(40);
const options = {
  otpSecret: "o".repeat(40),
  invitationTokenSecret: invitationSecret,
  invitationExpiresIn: 86_400,
  activationOtpExpiryMinutes: 10,
  activationOtpMaxAttempts: 3,
  activationOtpResendCooldownSeconds: 60,
  adminAccessTokenSecret: "a".repeat(40),
  adminAccessTokenExpiresIn: 900,
  adminRefreshTokenSecret: "r".repeat(40),
  adminRefreshTokenExpiresIn: 2_592_000,
  customerAccessTokenSecret: "c".repeat(40),
  customerRefreshTokenSecret: "u".repeat(40),
  adminLoginOtpExpiryMinutes: 10,
  adminLoginOtpMaxAttempts: 3,
  adminLoginOtpResendCooldownSeconds: 60,
  adminPasswordChangeProofExpiresIn: 600,
  adminActivationUrl: "https://admin.example.test/activate",
  now: () => now,
  generateOtp: () => "123456"
};

const pendingAdmin = (password = "TemporaryAdminPassword123!"): AdminRecord => ({
  id: "ef4ccdc7-38a1-4bef-9c9e-15ebd04cb840",
  full_name: "Invited Admin",
  email: "invited@example.com",
  phone: null,
  department: "MANAGEMENT",
  admin_role: "ADMIN",
  status: "PENDING",
  password_hash: hashAdminPassword(password),
  requires_password_change: true,
  session_version: 1,
  last_login_at: null,
  created_at: now.toISOString(),
  updated_at: now.toISOString()
});

const makeStore = (overrides: Record<string, unknown> = {}) => ({
  createInvitation: vi.fn(),
  cancelPendingInvitation: vi.fn().mockResolvedValue(undefined),
  findInvitationByTokenHash: vi.fn(),
  replaceOtp: vi.fn(),
  invalidateOtp: vi.fn().mockResolvedValue(undefined),
  completeActivation: vi.fn(),
  findAdminById: vi.fn(),
  listStaff: vi.fn(),
  ...overrides
});

const makeMail = (overrides: Partial<AdminMailService> = {}) => ({
  sendAdminInvitation: vi.fn().mockResolvedValue(undefined),
  sendAdminOtp: vi.fn().mockResolvedValue(undefined),
  ...overrides
});

const serviceFor = (store: Record<string, unknown>, mail: AdminMailService) =>
  new AdminAuthService(store as unknown as SupabaseAdminAuthStore, mail, options);

describe("Admin staff management and invitation security", () => {
  beforeEach(() => vi.clearAllMocks());

  it("protects staff operations with isolated Super Admin sessions while activation remains token-protected", () => {
    const routes = readFileSync(path.resolve(__dirname, "admin-auth.routes.ts"), "utf8");
    expect(routes).toContain('router.get("/staff", adminSessionMiddleware, requireAdminRole("SUPER_ADMIN")');
    expect(routes).toContain('router.post("/staff/invite", adminSessionMiddleware, requireAdminRole("SUPER_ADMIN")');
    expect(routes).toContain('router.post("/staff/:adminId/resend-invitation", adminSessionMiddleware, requireAdminRole("SUPER_ADMIN")');
    expect(routes).toContain('router.post("/auth/activate", adminOtpRateLimiter');
    expect(routes).not.toMatch(/customerSessionMiddleware|requireVerifiedCustomer/);
  });

  it("normalizes valid emails and rejects invalid emails or roles outside the allow-list", () => {
    expect(inviteAdminSchema.parse({ fullName: "New Admin", email: "  ADMIN@Example.com ", department: "TECH", adminRole: "ADMIN" }).email).toBe("admin@example.com");
    expect(inviteAdminSchema.safeParse({ fullName: "New Admin", email: "not-an-email", department: "TECH", adminRole: "ADMIN" }).success).toBe(false);
    expect(inviteAdminSchema.safeParse({ fullName: "New Admin", email: "admin@example.com", department: "TECH", adminRole: "OWNER" }).success).toBe(false);
  });

  it("creates a pending invitation with hashed secrets and returns no reusable credential", async () => {
    const createInvitation = vi.fn().mockResolvedValue({ result_status: "OK", result_admin_id: pendingAdmin().id });
    const store = makeStore({ createInvitation });
    const mail = makeMail();
    const result = await serviceFor(store, mail).invite("super-admin-id", { fullName: "Invited Admin", email: "invited@example.com", department: "MANAGEMENT", adminRole: "ADMIN" });

    const persisted = createInvitation.mock.calls[0][0];
    const delivered = vi.mocked(mail.sendAdminInvitation).mock.calls[0][0];
    const rawToken = new URL(delivered.activationUrl).searchParams.get("token");
    expect(rawToken).toBeTruthy();
    expect(persisted.invitedByAdminId).toBe("super-admin-id");
    expect(persisted.tokenHash).toBe(hashAdminInvitationToken(invitationSecret, rawToken!));
    expect(persisted.tokenHash).not.toBe(rawToken);
    expect(verifyAdminPassword(delivered.temporaryPassword, persisted.passwordHash)).toBe(true);
    expect(persisted.passwordHash).not.toBe(delivered.temporaryPassword);
    expect(delivered.to).toBe("invited@example.com");
    expect(JSON.stringify(result)).not.toMatch(/token|password/i);
    expect(result).toMatchObject({ adminId: pendingAdmin().id, status: "PENDING" });
  });

  it("returns a deterministic conflict for an existing Admin instead of creating a duplicate", async () => {
    const store = makeStore({ createInvitation: vi.fn().mockResolvedValue({ result_status: "EMAIL_EXISTS", result_admin_id: pendingAdmin().id }) });
    await expect(serviceFor(store, makeMail()).invite("super-admin-id", { fullName: "Duplicate", email: "invited@example.com", department: "TECH", adminRole: "ADMIN" })).rejects.toMatchObject({ statusCode: 409, code: "ADMIN_EMAIL_ALREADY_EXISTS" });
  });

  it("revokes the pending invitation and exposes only a stable error when email delivery fails", async () => {
    const cancelPendingInvitation = vi.fn().mockResolvedValue(undefined);
    const store = makeStore({ createInvitation: vi.fn().mockResolvedValue({ result_status: "OK", result_admin_id: pendingAdmin().id }), cancelPendingInvitation });
    const mail = makeMail({ sendAdminInvitation: vi.fn().mockRejectedValue(new Error("provider secret")) });
    await expect(serviceFor(store, mail).invite("super-admin-id", { fullName: "Invited Admin", email: "invited@example.com", department: "MANAGEMENT", adminRole: "ADMIN" })).rejects.toMatchObject({ statusCode: 503, code: "MAIL_DELIVERY_FAILED" });
    expect(cancelPendingInvitation).toHaveBeenCalledWith(pendingAdmin().id, now);
  });

  it.each([
    [null, "INVALID_INVITATION_TOKEN", 400],
    [{ status: "USED", expires_at: new Date(now.getTime() + 60_000).toISOString(), admin: pendingAdmin() }, "INVITATION_ALREADY_USED", 409],
    [{ status: "PENDING", expires_at: new Date(now.getTime() - 1).toISOString(), admin: pendingAdmin() }, "INVITATION_EXPIRED", 400]
  ])("rejects invalid, used, and expired invitation states", async (invitation, code, statusCode) => {
    const store = makeStore({ findInvitationByTokenHash: vi.fn().mockResolvedValue(invitation) });
    await expect(serviceFor(store, makeMail()).activate({ invitationToken: "t".repeat(43), temporaryPassword: "TemporaryAdminPassword123!" })).rejects.toMatchObject({ code, statusCode });
  });

  it("validates a pending invitation by token hash and intended Admin password before sending OTP", async () => {
    const temporaryPassword = "TemporaryAdminPassword123!";
    const admin = pendingAdmin(temporaryPassword);
    const findInvitationByTokenHash = vi.fn().mockResolvedValue({ status: "PENDING", expires_at: new Date(now.getTime() + 60_000).toISOString(), admin });
    const store = makeStore({ findInvitationByTokenHash, replaceOtp: vi.fn().mockResolvedValue({ result_status: "OK", result_challenge_id: "a16d533e-b668-48e5-b4ee-dd6c3c339c83" }) });
    const mail = makeMail();
    const rawToken = "secure-invitation-token-value-at-least-32";
    const result = await serviceFor(store, mail).activate({ invitationToken: rawToken, temporaryPassword });
    expect(findInvitationByTokenHash).toHaveBeenCalledWith(hashAdminInvitationToken(invitationSecret, rawToken));
    expect(findInvitationByTokenHash).not.toHaveBeenCalledWith(rawToken);
    expect(mail.sendAdminOtp).toHaveBeenCalledWith(expect.objectContaining({ to: admin.email, purpose: "activation", otp: "123456" }));
    expect(result).toMatchObject({ challengeId: "a16d533e-b668-48e5-b4ee-dd6c3c339c83", maskedEmail: "i***d@example.com", nextAction: "VERIFY_ADMIN_ACTIVATION_OTP" });
  });

  it("atomically activates the invited Admin with hashed setup proof and password without creating a customer session", async () => {
    const completeActivation = vi.fn().mockResolvedValue({ result_status: "OK", result_admin_id: pendingAdmin().id });
    const store = makeStore({ completeActivation, findAdminById: vi.fn().mockResolvedValue({ ...pendingAdmin(), status: "ACTIVE" }) });
    const result = await serviceFor(store, makeMail()).setPassword({ setupToken: "single-use-setup-token-value-at-least-32", newPassword: "PermanentAdminPassword123!" });
    const [proofHash, passwordHash] = completeActivation.mock.calls[0];
    expect(proofHash).toBe(hashAdminSecret("single-use-setup-token-value-at-least-32"));
    expect(verifyAdminPassword("PermanentAdminPassword123!", passwordHash)).toBe(true);
    expect(result).toEqual({ status: "ACTIVE", nextAction: "ADMIN_LOGIN" });
    expect(store).not.toHaveProperty("createCustomerSession");
  });

  it.each([
    ["USED_PROOF", "ADMIN_SETUP_TOKEN_USED", 409],
    ["EXPIRED_PROOF", "ADMIN_SETUP_TOKEN_EXPIRED", 401],
    ["INVALID_PROOF", "INVALID_ADMIN_SETUP_TOKEN", 401]
  ])("maps single-use setup proof failures without leaking storage details", async (resultStatus, code, statusCode) => {
    const store = makeStore({ completeActivation: vi.fn().mockResolvedValue({ result_status: resultStatus }) });
    await expect(serviceFor(store, makeMail()).setPassword({ setupToken: "single-use-setup-token-value-at-least-32", newPassword: "PermanentAdminPassword123!" })).rejects.toMatchObject({ code, statusCode });
  });

  it("maps the Admin table to a bounded staff DTO without password, token, OTP, or session fields", async () => {
    const row = { ...pendingAdmin(), invitation_token: "must-not-leak", refresh_token: "must-not-leak" };
    const result = await serviceFor(makeStore({ listStaff: vi.fn().mockResolvedValue([row]) }), makeMail()).listStaff();
    expect(result[0]).toEqual({ id: row.id, fullName: row.full_name, email: row.email, phone: row.phone, department: row.department, adminRole: row.admin_role, status: row.status, requiresPasswordChange: row.requires_password_change, createdAt: row.created_at, updatedAt: row.updated_at });
    expect(JSON.stringify(result)).not.toMatch(/password_hash|token|session/i);
  });

  it("persists one pending hashed invitation per isolated Admin and consumes it atomically", () => {
    const foundation = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/202607280001_auth_onboarding_foundation.sql"), "utf8");
    const transactions = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/202608050001_admin_authentication_staff.sql"), "utf8");
    expect(foundation).toContain("create table if not exists public.admin_invitations");
    expect(foundation).toContain("admin_invitations_token_hash_uidx");
    expect(foundation).toContain("admin_invitations_one_pending_uidx");
    expect(transactions).toContain("update public.admin_invitations set status = 'USED'");
    expect(transactions).toContain("update public.admins set password_hash = p_password_hash, status = 'ACTIVE'");
    expect(transactions).not.toMatch(/insert into public\.(profiles|customer_records)/);
  });
});
