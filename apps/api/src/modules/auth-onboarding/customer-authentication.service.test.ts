import { beforeEach, describe, expect, it, vi } from "vitest";
import { MailService } from "../../services/mail.service";
import { CustomerAuthenticationService } from "./customer-authentication.service";
import { CustomerAuthenticationStore } from "./customer-authentication.types";
import {
  issueCustomerRefreshToken,
  verifyCustomerAccessToken
} from "./customer-session.tokens";

const userId = "11111111-1111-4111-8111-111111111111";
const accessSecret = "access-secret-that-is-at-least-32-characters";
const refreshSecret = "refresh-secret-that-is-at-least-32-characters";
let currentTime = new Date("2026-08-03T10:00:00.000Z");

const authenticate = vi.fn();
const getCustomerState = vi.fn();
const createSession = vi.fn();
const rotateSession = vi.fn();
const revokeSession = vi.fn();
const replacePasswordResetOtp = vi.fn();
const invalidatePasswordResetOtp = vi.fn();
const verifyPasswordResetOtp = vi.fn();
const resetPassword = vi.fn();
const changePassword = vi.fn();

const store = {
  authenticate,
  getCustomerState,
  createSession,
  rotateSession,
  revokeSession,
  replacePasswordResetOtp,
  invalidatePasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
  changePassword
} as unknown as CustomerAuthenticationStore;

const sendPasswordResetOtp = vi.fn();
const mail = {
  sendRegistrationOtp: vi.fn(),
  sendPasswordResetOtp
} as unknown as MailService;

const buyerState = {
  id: userId,
  fullName: "Test Customer",
  email: "customer@example.com",
  phone: "+2348012345678",
  accountStatus: "ACTIVE" as const,
  emailVerified: true,
  sessionVersion: 3,
  activePersona: "BUYER" as const,
  lastActivePersona: "BUYER" as const,
  personas: [{ type: "BUYER" as const, onboardingStatus: "COMPLETED" as const }]
};

const service = new CustomerAuthenticationService(store, mail, {
  otpSecret: "otp-secret-that-is-at-least-32-characters-long",
  accessTokenSecret: accessSecret,
  refreshTokenSecret: refreshSecret,
  accessTokenExpiresIn: 900,
  refreshTokenExpiresIn: 2_592_000,
  otpExpiryMinutes: 10,
  otpResendCooldownSeconds: 60,
  otpMaxAttempts: 3,
  resetProofExpiresIn: 600,
  now: () => currentTime,
  generateOtp: () => "419205"
});

describe("customer authentication service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentTime = new Date("2026-08-03T10:00:00.000Z");
    authenticate.mockResolvedValue(userId);
    getCustomerState.mockResolvedValue({ ...buyerState });
    createSession.mockResolvedValue({ status: "OK", sessionVersion: 3 });
    rotateSession.mockResolvedValue({ status: "OK", sessionVersion: 3 });
    revokeSession.mockResolvedValue({ status: "OK" });
    replacePasswordResetOtp.mockResolvedValue({ status: "NOT_ELIGIBLE" });
    invalidatePasswordResetOtp.mockResolvedValue(undefined);
    verifyPasswordResetOtp.mockResolvedValue({ status: "VERIFIED" });
    resetPassword.mockResolvedValue({ status: "OK" });
    changePassword.mockResolvedValue({ status: "OK" });
    sendPasswordResetOtp.mockResolvedValue(undefined);
  });

  it("logs in by normalized email and creates a hashed refresh session", async () => {
    const result = await service.login({
      identifier: "customer@example.com",
      password: "Password123!"
    });

    expect(authenticate).toHaveBeenCalledWith(
      "customer@example.com",
      "Password123!"
    );
    expect(createSession).toHaveBeenCalledOnce();
    const stored = createSession.mock.calls[0][0];
    expect(stored.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.refreshTokenHash).not.toBe(result.refreshToken);
    expect(result).toMatchObject({
      activePersona: "BUYER",
      nextAction: "OPEN_BUYER_DASHBOARD",
      accessTokenExpiresIn: 900,
      refreshTokenExpiresIn: 2_592_000
    });
    expect(
      verifyCustomerAccessToken(result.accessToken, accessSecret, currentTime)
    ).toMatchObject({ sub: userId, ver: 3, typ: "customer_access" });
  });

  it("logs in by normalized phone", async () => {
    await service.login({
      identifier: "+2348012345678",
      password: "Password123!"
    });
    expect(authenticate).toHaveBeenCalledWith(
      "+2348012345678",
      "Password123!"
    );
  });

  it("uses one generic invalid-credential error", async () => {
    authenticate.mockResolvedValue(null);
    await expect(
      service.login({ identifier: "missing@example.com", password: "wrong" })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
      message: "Incorrect email/phone or password"
    });
  });

  it.each([
    ["PENDING_VERIFICATION", false, "ACCOUNT_VERIFICATION_REQUIRED", 403],
    ["SUSPENDED", true, "ACCOUNT_SUSPENDED", 403],
    ["LOCKED", true, "ACCOUNT_LOCKED", 423]
  ] as const)("rejects %s accounts", async (accountStatus, emailVerified, code, statusCode) => {
    getCustomerState.mockResolvedValue({
      ...buyerState,
      accountStatus,
      emailVerified
    });
    await expect(
      service.login({ identifier: "customer@example.com", password: "Password123!" })
    ).rejects.toMatchObject({ code, statusCode });
    expect(createSession).not.toHaveBeenCalled();
  });

  it.each([
    ["BUYER", "NOT_STARTED", "COMPLETE_BUYER_ONBOARDING"],
    ["BUYER", "COMPLETED", "OPEN_BUYER_DASHBOARD"],
    ["SELLER_DEVELOPER", "NOT_STARTED", "COMPLETE_SELLER_ONBOARDING"],
    ["SELLER_DEVELOPER", "COMPLETED", "OPEN_SELLER_DASHBOARD"]
  ] as const)("routes %s/%s login correctly", async (type, onboardingStatus, nextAction) => {
    getCustomerState.mockResolvedValue({
      ...buyerState,
      activePersona: type,
      lastActivePersona: type,
      personas: [{ type, onboardingStatus }]
    });
    await expect(
      service.login({ identifier: "customer@example.com", password: "Password123!" })
    ).resolves.toMatchObject({ activePersona: type, nextAction });
  });

  it("restores lastActivePersona when two personas exist", async () => {
    getCustomerState.mockResolvedValue({
      ...buyerState,
      activePersona: "BUYER",
      lastActivePersona: "SELLER_DEVELOPER",
      personas: [
        { type: "BUYER", onboardingStatus: "COMPLETED" },
        { type: "SELLER_DEVELOPER", onboardingStatus: "NOT_STARTED" }
      ]
    });
    await expect(
      service.login({ identifier: "customer@example.com", password: "Password123!" })
    ).resolves.toMatchObject({
      activePersona: "SELLER_DEVELOPER",
      nextAction: "COMPLETE_SELLER_ONBOARDING"
    });
  });

  it("rotates a refresh token and stores only replacement hashes", async () => {
    const oldToken = issueCustomerRefreshToken({
      secret: refreshSecret,
      userId,
      sessionId: "22222222-2222-4222-8222-222222222222",
      expiresIn: 2_592_000,
      now: currentTime
    });
    const result = await service.refresh(oldToken);
    const rotation = rotateSession.mock.calls[0][0];

    expect(rotation.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(rotation.replacementRefreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(rotation.replacementRefreshTokenHash).not.toBe(result.refreshToken);
    expect(result.refreshToken).not.toBe(oldToken);
  });

  it.each([
    ["REFRESH_TOKEN_REUSED", "REFRESH_TOKEN_REUSED"],
    ["REFRESH_TOKEN_REVOKED", "REFRESH_TOKEN_REVOKED"],
    ["SESSION_NOT_FOUND", "SESSION_NOT_FOUND"]
  ] as const)("returns stable %s refresh errors", async (status, code) => {
    rotateSession.mockResolvedValue({ status });
    const token = issueCustomerRefreshToken({
      secret: refreshSecret,
      userId,
      sessionId: "22222222-2222-4222-8222-222222222222",
      expiresIn: 2_592_000,
      now: currentTime
    });
    await expect(service.refresh(token)).rejects.toMatchObject({ code });
  });

  it("rejects an expired refresh token before storage lookup", async () => {
    const token = issueCustomerRefreshToken({
      secret: refreshSecret,
      userId,
      sessionId: "22222222-2222-4222-8222-222222222222",
      expiresIn: 1,
      now: currentTime
    });
    currentTime = new Date(currentTime.getTime() + 2_000);
    await expect(service.refresh(token)).rejects.toMatchObject({
      code: "REFRESH_TOKEN_EXPIRED"
    });
    expect(rotateSession).not.toHaveBeenCalled();
  });

  it("revokes logout sessions and handles repeat logout idempotently", async () => {
    const sessionId = "22222222-2222-4222-8222-222222222222";
    const token = issueCustomerRefreshToken({
      secret: refreshSecret,
      userId,
      sessionId,
      expiresIn: 2_592_000,
      now: currentTime
    });
    await service.logout({ userId, sessionId }, token);
    await service.logout({ userId, sessionId }, token);
    expect(revokeSession).toHaveBeenCalledTimes(2);
  });

  it("returns the same forgot-password response for an unknown account", async () => {
    await expect(service.forgotPassword("missing@example.com")).resolves.toEqual({
      otpLength: 6,
      resendAvailableIn: 60,
      nextAction: "VERIFY_PASSWORD_RESET_OTP"
    });
    expect(sendPasswordResetOtp).not.toHaveBeenCalled();
  });

  it("stores only a reset OTP hash and sends the OTP through the mail adapter", async () => {
    replacePasswordResetOtp.mockResolvedValue({
      status: "REPLACED",
      challengeId: "challenge-id",
      email: "customer@example.com",
      fullName: "Test Customer"
    });
    await service.forgotPassword("customer@example.com");
    const stored = replacePasswordResetOtp.mock.calls[0][0];
    expect(stored.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.codeHash).not.toContain("419205");
    expect(sendPasswordResetOtp).toHaveBeenCalledWith(
      expect.objectContaining({ otp: "419205" })
    );
  });

  it("invalidates a reset challenge when email delivery fails", async () => {
    replacePasswordResetOtp.mockResolvedValue({
      status: "REPLACED",
      challengeId: "challenge-id",
      email: "customer@example.com",
      fullName: "Test Customer"
    });
    sendPasswordResetOtp.mockRejectedValue(new Error("provider rejected"));
    await expect(service.forgotPassword("customer@example.com")).rejects.toMatchObject({
      code: "MAIL_DELIVERY_FAILED"
    });
    expect(invalidatePasswordResetOtp).toHaveBeenCalledWith(
      "challenge-id",
      currentTime
    );
  });

  it.each([
    ["INVALID_OTP", "INVALID_OTP"],
    ["OTP_EXPIRED", "OTP_EXPIRED"],
    ["OTP_MAX_ATTEMPTS", "OTP_ATTEMPTS_EXCEEDED"],
    ["OTP_CONSUMED", "OTP_NO_LONGER_VALID"]
  ] as const)("maps reset OTP %s safely", async (status, code) => {
    verifyPasswordResetOtp.mockResolvedValue({ status, attemptsRemaining: 2 });
    await expect(
      service.verifyPasswordResetOtp({
        email: "customer@example.com",
        otp: "419205"
      })
    ).rejects.toMatchObject({ code });
  });

  it("issues a short-lived reset proof while storing only its hash", async () => {
    const result = await service.verifyPasswordResetOtp({
      email: "customer@example.com",
      otp: "419205"
    });
    const stored = verifyPasswordResetOtp.mock.calls[0][0];
    expect(result).toMatchObject({ expiresIn: 600, nextAction: "SET_NEW_PASSWORD" });
    expect(stored.proofHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.proofHash).not.toBe(result.resetToken);
  });

  it("resets the password and invalidates every session", async () => {
    await expect(
      service.resetPassword("reset-proof-token-at-least-32-characters", "NewPassword123!")
    ).resolves.toEqual({ sessionsInvalidated: true, nextAction: "LOGIN" });
  });

  it.each([
    ["INVALID_RESET_TOKEN", 401],
    ["RESET_TOKEN_EXPIRED", 401],
    ["RESET_TOKEN_USED", 409],
    ["NEW_PASSWORD_SAME_AS_CURRENT", 400]
  ] as const)("returns stable %s reset-proof errors", async (status, statusCode) => {
    resetPassword.mockResolvedValue({ status });
    await expect(
      service.resetPassword("reset-proof-token-at-least-32-characters", "NewPassword123!")
    ).rejects.toMatchObject({ code: status, statusCode });
  });

  it("requires the correct current password for authenticated change", async () => {
    changePassword.mockResolvedValue({ status: "CURRENT_PASSWORD_INCORRECT" });
    await expect(
      service.changePassword(userId, "wrong", "NewPassword123!")
    ).rejects.toMatchObject({ code: "CURRENT_PASSWORD_INCORRECT" });
    expect(changePassword).toHaveBeenCalledWith(
      expect.objectContaining({ currentPassword: "wrong" })
    );
  });

  it("rejects a new password equal to the current password", async () => {
    await expect(
      service.changePassword(userId, "Password123!", "Password123!")
    ).rejects.toMatchObject({ code: "NEW_PASSWORD_SAME_AS_CURRENT" });
  });

  it("changes the password and invalidates all sessions", async () => {
    await expect(
      service.changePassword(userId, "Password123!", "NewPassword123!")
    ).resolves.toEqual({ sessionsInvalidated: true, nextAction: "LOGIN" });
    expect(changePassword).toHaveBeenCalledWith({
      userId,
      currentPassword: "Password123!",
      newPassword: "NewPassword123!",
      now: currentTime
    });
  });
});
