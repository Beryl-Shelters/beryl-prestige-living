import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "../../config/supabase";
import { personaForGettingStartedAs } from "./auth-onboarding.types";
import {
  CustomerRegistrationConflictError,
  CustomerRegistrationInfrastructureError,
  CustomerRegistrationStore,
  RegisterCustomerInput,
  ReplaceOtpResult,
  VerifyOtpResult
} from "./customer-registration.types";

const infrastructureFailure = () =>
  new CustomerRegistrationInfrastructureError("Customer registration storage failed");

const authConflict = (error?: { code?: string; message: string } | null) => {
  const code = error?.code?.toLowerCase();
  const message = error?.message.toLowerCase() ?? "";

  if (
    code === "email_exists" ||
    (message.includes("email") && message.includes("already"))
  ) {
    return "EMAIL" as const;
  }
  if (
    code === "phone_exists" ||
    (message.includes("phone") && message.includes("already"))
  ) {
    return "PHONE" as const;
  }
  return null;
};

const profileConflict = (message: string) => {
  if (message.includes("profiles_email_normalized_uidx")) return "EMAIL" as const;
  if (
    message.includes("profiles_phone_normalized_uidx") ||
    message.includes("profiles_phone_number_uidx")
  ) {
    return "PHONE" as const;
  }
  return null;
};

const splitName = (fullName: string) => {
  const [firstName, ...remaining] = fullName.trim().split(/\s+/);
  return { firstName, lastName: remaining.join(" ") };
};

export class SupabaseCustomerRegistrationStore
  implements CustomerRegistrationStore
{
  async findConflict(email: string, phone: string) {
    const [emailResult, phoneResult] = await Promise.all([
      supabaseAdmin.from("profiles").select("id").ilike("email", email).limit(1),
      supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("phone_number", phone)
        .limit(1)
    ]);

    if (emailResult.error || phoneResult.error) throw infrastructureFailure();
    if (emailResult.data?.length) return "EMAIL" as const;
    if (phoneResult.data?.length) return "PHONE" as const;
    return null;
  }

  async createPendingCustomer(input: RegisterCustomerInput) {
    const initialPersona = personaForGettingStartedAs[input.gettingStartedAs];
    const { firstName, lastName } = splitName(input.fullName);
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: input.email,
        phone: input.phone,
        password: input.password,
        email_confirm: false,
        phone_confirm: false,
        user_metadata: {
          full_name: input.fullName,
          initial_persona: initialPersona
        }
      });

    if (authError || !authData.user) {
      const duplicate = authConflict(authError);
      if (duplicate) throw new CustomerRegistrationConflictError(duplicate);
      throw infrastructureFailure();
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: authData.user.id,
      first_name: firstName,
      last_name: lastName,
      full_name: input.fullName,
      email: input.email,
      phone_number: input.phone,
      is_whatsapp_number: input.isWhatsAppNumber,
      whatsapp_number: input.whatsAppNumber ?? input.phone,
      role: null,
      profile_type: null,
      verification_status: "pending",
      is_active: false,
      account_status: "PENDING_VERIFICATION",
      initial_persona: initialPersona,
      active_persona: null,
      last_active_persona: null,
      email_verified_at: null,
      registration_source: "CUSTOMER_APP",
      referral_code: `BPL-${randomBytes(5).toString("hex").toUpperCase()}`
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      if (profileError.code === "23505") {
        const duplicate = profileConflict(profileError.message);
        if (duplicate) throw new CustomerRegistrationConflictError(duplicate);
      }
      throw infrastructureFailure();
    }

    return {
      id: authData.user.id,
      fullName: input.fullName,
      email: input.email
    };
  }

  async deletePendingCustomer(userId: string) {
    await supabaseAdmin.from("profiles").delete().eq("id", userId);
    await supabaseAdmin.auth.admin.deleteUser(userId);
  }

  async replaceVerificationOtp(input: {
    email: string;
    codeHash: string;
    expiresAt: Date;
    resendAvailableAt: Date;
    maxAttempts: number;
    now: Date;
  }): Promise<ReplaceOtpResult> {
    const { data, error } = await supabaseAdmin
      .rpc("replace_customer_verification_otp", {
        p_email: input.email,
        p_code_hash: input.codeHash,
        p_expires_at: input.expiresAt.toISOString(),
        p_resend_available_at: input.resendAvailableAt.toISOString(),
        p_max_attempts: input.maxAttempts,
        p_now: input.now.toISOString()
      })
      .single();

    if (error || !data) throw infrastructureFailure();
    const row = data as Record<string, unknown>;

    return {
      status: row.result_status as ReplaceOtpResult["status"],
      challengeId: row.result_challenge_id as string | undefined,
      userId: row.result_user_id as string | undefined,
      email: row.result_email as string | undefined,
      fullName: row.result_full_name as string | undefined,
      resendAvailableAt: row.result_resend_available_at
        ? new Date(row.result_resend_available_at as string)
        : undefined
    };
  }

  async invalidateVerificationOtp(challengeId: string, now: Date) {
    const { error } = await supabaseAdmin
      .from("otp_challenges")
      .update({ invalidated_at: now.toISOString() })
      .eq("id", challengeId)
      .is("consumed_at", null);

    if (error) throw infrastructureFailure();
  }

  async verifyEmailOtp(input: {
    email: string;
    codeHash: string;
    now: Date;
  }): Promise<VerifyOtpResult> {
    const { data, error } = await supabaseAdmin
      .rpc("verify_customer_email_otp", {
        p_email: input.email,
        p_code_hash: input.codeHash,
        p_now: input.now.toISOString()
      })
      .single();

    if (error || !data) throw infrastructureFailure();
    const row = data as Record<string, unknown>;

    return {
      status: row.result_status as VerifyOtpResult["status"],
      userId: row.result_user_id as string | undefined,
      accountStatus: row.result_account_status as VerifyOtpResult["accountStatus"],
      emailVerified: row.result_email_verified as boolean | undefined,
      activePersona: row.result_active_persona as VerifyOtpResult["activePersona"],
      personas: row.result_personas as VerifyOtpResult["personas"],
      onboardingStatus:
        row.result_onboarding_status as VerifyOtpResult["onboardingStatus"],
      nextAction: row.result_next_action as string | undefined,
      attemptsRemaining: row.result_attempts_remaining as number | undefined
    };
  }

}
