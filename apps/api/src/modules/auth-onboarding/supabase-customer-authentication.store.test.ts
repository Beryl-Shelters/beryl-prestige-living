import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerAuthenticationInfrastructureError } from "./customer-authentication.types";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  updateUserById: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../../config/supabase", () => ({
  supabase: { auth: { signInWithPassword: mocks.signInWithPassword } },
  supabaseAdmin: {
    auth: { admin: { updateUserById: mocks.updateUserById } },
    rpc: mocks.rpc,
  },
}));

import { SupabaseCustomerAuthenticationStore } from "./supabase-customer-authentication.store";

const userId = "11111111-1111-4111-8111-111111111111";
const proofHash = "a".repeat(64);
const now = new Date("2026-08-31T10:00:00.000Z");
const store = new SupabaseCustomerAuthenticationStore();

const rpcResult = (data: Record<string, unknown>) => ({
  single: vi.fn().mockResolvedValue({ data, error: null }),
});

describe("Supabase Customer password authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockImplementation((name: string) => name === "consume_customer_password_reset_proof"
      ? rpcResult({ result_status: "OK", result_user_id: userId })
      : rpcResult({ result_status: "OK" }));
    mocks.updateUserById.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.signInWithPassword.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  });

  it("consumes the narrow proof before updating only its intended Supabase Auth user", async () => {
    await expect(store.resetPassword({ proofHash, newPassword: "NewPassword123!", now }))
      .resolves.toEqual({ status: "OK", userId });

    expect(mocks.rpc).toHaveBeenCalledWith("consume_customer_password_reset_proof", {
      p_proof_hash: proofHash,
    });
    expect(mocks.updateUserById).toHaveBeenCalledWith(userId, { password: "NewPassword123!" });
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.updateUserById.mock.invocationCallOrder[0]);
  });

  it("does not send application time when verifying a password-recovery OTP", async () => {
    mocks.rpc.mockReturnValueOnce(rpcResult({
      result_status: "VERIFIED",
      result_attempts_remaining: null,
    }));

    await expect(store.verifyPasswordResetOtp({
      email: "customer@example.com",
      codeHash: "b".repeat(64),
      proofHash,
    })).resolves.toEqual({ status: "VERIFIED", attemptsRemaining: null });

    expect(mocks.rpc).toHaveBeenCalledWith("verify_customer_password_reset_otp", {
      p_email: "customer@example.com",
      p_code_hash: "b".repeat(64),
      p_proof_hash: proofHash,
    });
  });

  it.each(["INVALID_RESET_TOKEN", "RESET_TOKEN_EXPIRED", "RESET_TOKEN_USED"] as const)(
    "does not call Supabase Auth for %s",
    async (status) => {
      mocks.rpc.mockReturnValueOnce(rpcResult({ result_status: status, result_user_id: userId }));
      await expect(store.resetPassword({ proofHash, newPassword: "NewPassword123!", now }))
        .resolves.toMatchObject({ status });
      expect(mocks.updateUserById).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["weak_password", "PASSWORD_POLICY_INVALID"],
    ["validation_failed", "PASSWORD_POLICY_INVALID"],
    ["same_password", "NEW_PASSWORD_SAME_AS_CURRENT"],
  ] as const)("maps Supabase %s without exposing provider details", async (code, status) => {
    mocks.updateUserById.mockResolvedValueOnce({ data: { user: null }, error: { code, message: "private provider detail" } });
    await expect(store.resetPassword({ proofHash, newPassword: "NewPassword123!", now }))
      .resolves.toMatchObject({ status });
  });

  it("sanitizes unexpected Supabase password-update failures", async () => {
    mocks.updateUserById.mockResolvedValueOnce({ data: { user: null }, error: { code: "unexpected_failure", message: "private provider detail" } });
    await expect(store.resetPassword({ proofHash, newPassword: "NewPassword123!", now }))
      .rejects.toBeInstanceOf(CustomerAuthenticationInfrastructureError);
  });

  it("requires current-password authentication for the intended Customer before change", async () => {
    mocks.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { code: "invalid_credentials" } });
    await expect(store.changePassword({ userId, email: "customer@example.com", currentPassword: "wrong", newPassword: "NewPassword123!", now }))
      .resolves.toEqual({ status: "CURRENT_PASSWORD_INCORRECT" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("does not let valid credentials for a different account target an arbitrary Customer", async () => {
    mocks.signInWithPassword.mockResolvedValueOnce({ data: { user: { id: "22222222-2222-4222-8222-222222222222" } }, error: null });
    await expect(store.changePassword({ userId, email: "customer@example.com", currentPassword: "Password123!", newPassword: "NewPassword123!", now }))
      .resolves.toEqual({ status: "CURRENT_PASSWORD_INCORRECT" });
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });

  it("revokes custom sessions before the server-only authenticated password update", async () => {
    await expect(store.changePassword({ userId, email: "customer@example.com", currentPassword: "Password123!", newPassword: "NewPassword123!", now }))
      .resolves.toEqual({ status: "OK" });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "customer@example.com", password: "Password123!" });
    expect(mocks.rpc).toHaveBeenCalledWith("revoke_customer_sessions_for_password_change", { p_user_id: userId });
    expect(mocks.updateUserById).toHaveBeenCalledWith(userId, { password: "NewPassword123!" });
  });

  it("accepts the new password and rejects the old password after reset in the controlled Auth adapter", async () => {
    let authoritativePassword = "OldPassword123!";
    mocks.updateUserById.mockImplementation(async (_id: string, input: { password: string }) => {
      authoritativePassword = input.password;
      return { data: { user: { id: userId } }, error: null };
    });
    mocks.signInWithPassword.mockImplementation(async ({ password }: { password: string }) => password === authoritativePassword
      ? { data: { user: { id: userId } }, error: null }
      : { data: { user: null }, error: { code: "invalid_credentials" } });

    await store.resetPassword({ proofHash, newPassword: "NewPassword123!", now });

    await expect(store.authenticate("customer@example.com", "OldPassword123!")).resolves.toBeNull();
    await expect(store.authenticate("customer@example.com", "NewPassword123!")).resolves.toBe(userId);
  });
});
