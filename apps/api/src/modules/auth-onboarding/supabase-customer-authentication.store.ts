import { supabase, supabaseAdmin } from "../../config/supabase";
import {
  CustomerAccountStatus,
  PersonaOnboardingStatus,
  PersonaType
} from "./auth-onboarding.types";
import {
  AccountMutationStatus,
  ChangePasswordStatus,
  CustomerAuthenticationInfrastructureError,
  CustomerAuthenticationStore,
  CustomerIdentityState,
  ReplacePasswordResetOtpResult,
  ResetPasswordResult,
  SessionMutationStatus,
  VerifyPasswordResetOtpResult
} from "./customer-authentication.types";

const infrastructureFailure = () =>
  new CustomerAuthenticationInfrastructureError(
    "Customer authentication storage failed"
  );

const rowOf = (data: unknown) => data as Record<string, unknown>;

const passwordUpdateStatus = (
  error: { code?: string } | null
): "PASSWORD_POLICY_INVALID" | "NEW_PASSWORD_SAME_AS_CURRENT" | null => {
  if (!error) return null;
  if (error.code === "weak_password" || error.code === "validation_failed") {
    return "PASSWORD_POLICY_INVALID" as const;
  }
  if (error.code === "same_password") return "NEW_PASSWORD_SAME_AS_CURRENT" as const;
  throw infrastructureFailure();
};

export class SupabaseCustomerAuthenticationStore
  implements CustomerAuthenticationStore
{
  async authenticate(identifier: string, password: string) {
    const credentials = identifier.includes("@")
      ? { email: identifier, password }
      : { phone: identifier, password };
    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    return error || !data.user ? null : data.user.id;
  }

  async getCustomerState(userId: string): Promise<CustomerIdentityState | null> {
    const [profileResult, personasResult] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "id, full_name, first_name, last_name, email, phone_number, account_status, email_verified_at, session_version, active_persona, last_active_persona"
        )
        .eq("id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("user_personas")
        .select("persona_type, onboarding_status, activated_at")
        .eq("user_id", userId)
        .order("activated_at", { ascending: true })
    ]);

    if (profileResult.error || personasResult.error) throw infrastructureFailure();
    if (!profileResult.data) return null;
    const profile = rowOf(profileResult.data);
    if (!profile.active_persona || !profile.last_active_persona) {
      throw infrastructureFailure();
    }

    return {
      id: profile.id as string,
      fullName:
        (profile.full_name as string | null) ||
        [profile.first_name, profile.last_name].filter(Boolean).join(" "),
      email: profile.email as string,
      phone: profile.phone_number as string | null,
      accountStatus: profile.account_status as CustomerAccountStatus,
      emailVerified: Boolean(profile.email_verified_at),
      sessionVersion: Number(profile.session_version),
      activePersona: profile.active_persona as PersonaType,
      lastActivePersona: profile.last_active_persona as PersonaType,
      personas: (personasResult.data ?? []).map((persona) => ({
        type: persona.persona_type as PersonaType,
        onboardingStatus:
          persona.onboarding_status as PersonaOnboardingStatus
      }))
    };
  }

  async findCustomerIdByEmail(email: string) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (error) throw infrastructureFailure();
    return data?.id ?? null;
  }

  async createSession(input: Parameters<CustomerAuthenticationStore["createSession"]>[0]) {
    const { data, error } = await supabaseAdmin
      .rpc("create_customer_session", {
        p_user_id: input.userId,
        p_session_id: input.sessionId,
        p_refresh_token_hash: input.refreshTokenHash,
        p_expires_at: input.expiresAt.toISOString(),
        p_now: input.now.toISOString()
      })
      .single();
    if (error || !data) throw infrastructureFailure();
    const row = rowOf(data);
    return {
      status: row.result_status as AccountMutationStatus,
      sessionVersion: row.result_session_version as number | undefined
    };
  }

  async rotateSession(input: Parameters<CustomerAuthenticationStore["rotateSession"]>[0]) {
    const { data, error } = await supabaseAdmin
      .rpc("rotate_customer_session", {
        p_user_id: input.userId,
        p_session_id: input.sessionId,
        p_refresh_token_hash: input.refreshTokenHash,
        p_replacement_session_id: input.replacementSessionId,
        p_replacement_refresh_token_hash: input.replacementRefreshTokenHash,
        p_replacement_expires_at: input.replacementExpiresAt.toISOString(),
        p_now: input.now.toISOString()
      })
      .single();
    if (error || !data) throw infrastructureFailure();
    const row = rowOf(data);
    return {
      status: row.result_status as SessionMutationStatus,
      sessionVersion: row.result_session_version as number | undefined
    };
  }

  async revokeSession(input: Parameters<CustomerAuthenticationStore["revokeSession"]>[0]) {
    const { data, error } = await supabaseAdmin
      .rpc("revoke_customer_session", {
        p_user_id: input.userId,
        p_session_id: input.sessionId,
        p_refresh_token_hash: input.refreshTokenHash,
        p_now: input.now.toISOString()
      })
      .single();
    if (error || !data) throw infrastructureFailure();
    return { status: rowOf(data).result_status as SessionMutationStatus };
  }

  async replacePasswordResetOtp(
    input: Parameters<CustomerAuthenticationStore["replacePasswordResetOtp"]>[0]
  ): Promise<ReplacePasswordResetOtpResult> {
    const { data, error } = await supabaseAdmin
      .rpc("replace_customer_password_reset_otp", {
        p_email: input.email,
        p_code_hash: input.codeHash,
        p_expires_at: input.expiresAt.toISOString(),
        p_resend_available_at: input.resendAvailableAt.toISOString(),
        p_max_attempts: input.maxAttempts,
        p_now: input.now.toISOString()
      })
      .single();
    if (error || !data) throw infrastructureFailure();
    const row = rowOf(data);
    return {
      status: row.result_status as ReplacePasswordResetOtpResult["status"],
      challengeId: row.result_challenge_id as string | undefined,
      userId: row.result_user_id as string | undefined,
      email: row.result_email as string | undefined,
      fullName: row.result_full_name as string | undefined,
      resendAvailableAt: row.result_resend_available_at
        ? new Date(row.result_resend_available_at as string)
        : undefined
    };
  }

  async invalidatePasswordResetOtp(challengeId: string, now: Date) {
    const { error } = await supabaseAdmin
      .from("otp_challenges")
      .update({ invalidated_at: now.toISOString() })
      .eq("id", challengeId)
      .is("verified_proof_consumed_at", null);
    if (error) throw infrastructureFailure();
  }

  async verifyPasswordResetOtp(
    input: Parameters<CustomerAuthenticationStore["verifyPasswordResetOtp"]>[0]
  ): Promise<VerifyPasswordResetOtpResult> {
    const { data, error } = await supabaseAdmin
      .rpc("verify_customer_password_reset_otp", {
        p_email: input.email,
        p_code_hash: input.codeHash,
        p_proof_hash: input.proofHash
      })
      .single();
    if (error || !data) throw infrastructureFailure();
    const row = rowOf(data);
    return {
      status: row.result_status as VerifyPasswordResetOtpResult["status"],
      attemptsRemaining: row.result_attempts_remaining as number | undefined
    };
  }

  async resetPassword(
    input: Parameters<CustomerAuthenticationStore["resetPassword"]>[0]
  ): Promise<ResetPasswordResult> {
    const { data, error } = await supabaseAdmin
      .rpc("consume_customer_password_reset_proof", {
        p_proof_hash: input.proofHash
      })
      .single();
    if (error || !data) throw infrastructureFailure();
    const row = rowOf(data);
    const status = row.result_status as ResetPasswordResult["status"];
    const userId = row.result_user_id as string | undefined;
    if (status !== "OK" || !userId) return { status, userId };

    const update = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: input.newPassword
    });
    const updateStatus = passwordUpdateStatus(update.error);
    return { status: updateStatus ?? "OK", userId };
  }

  async changePassword(
    input: Parameters<CustomerAuthenticationStore["changePassword"]>[0]
  ): Promise<{ status: ChangePasswordStatus }> {
    const authenticated = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.currentPassword
    });
    if (authenticated.error || authenticated.data.user?.id !== input.userId) {
      return { status: "CURRENT_PASSWORD_INCORRECT" as const };
    }

    const { data, error } = await supabaseAdmin
      .rpc("revoke_customer_sessions_for_password_change", {
        p_user_id: input.userId
      })
      .single();
    if (error || !data) throw infrastructureFailure();
    const status = rowOf(data).result_status as ChangePasswordStatus;
    if (status !== "OK") return { status };

    const update = await supabaseAdmin.auth.admin.updateUserById(input.userId, {
      password: input.newPassword
    });
    return { status: passwordUpdateStatus(update.error) ?? "OK" };
  }
}
