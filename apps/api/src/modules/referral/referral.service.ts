import { randomBytes, randomInt } from "node:crypto";
import { env } from "../../config/env";
import { supabaseAdmin } from "../../config/supabase";
import { AppError } from "../../utils/AppError";
import { isE164Phone, normalizePhone } from "../auth-onboarding/normalization";
import { REFERRAL_BANK_DIRECTORY, referralBankByCode } from "./referral.banks";
import { ReferralOtpDelivery, referralOtpDelivery } from "./referral.provider";
import { createReferralTrackingToken, encryptAccountNumber, hashReferralSecret } from "./referral.security";
import { ReferralIdentity, ReferralLifecycle, referralStatusLabel } from "./referral.types";
import type { PayoutDetailsInput, SubmitReferralInput } from "./referral.validators";

const PUBLIC_WEB_URL = env.clientWebUrl.replace(/\/$/, "");
const OTP_TTL_SECONDS = 10 * 60;
const OTP_RESEND_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;
const TRACKING_SESSION_SECONDS = 30 * 24 * 60 * 60;

const referralLink = (code: string) => `${PUBLIC_WEB_URL}/r/${encodeURIComponent(code)}`;
const safeFailure = (message: string, code: string, status = 503) => new AppError(message, status, code);

const mapIdentity = (row: Record<string, unknown>): ReferralIdentity => ({
  id: String(row.id),
  customerUserId: typeof row.customer_user_id === "string" ? row.customer_user_id : null,
  fullName: String(row.full_name),
  phone: typeof row.phone_e164 === "string" ? row.phone_e164 : null,
  referralCode: String(row.referral_code)
});

const newReferralCode = () => `BSR-${randomBytes(5).toString("hex").toUpperCase()}`;

const createGuestIdentity = async (fullName: string, phone: string) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabaseAdmin.from("referrers").insert({
      full_name: fullName,
      phone_e164: phone,
      referral_code: newReferralCode()
    }).select("id,customer_user_id,full_name,phone_e164,referral_code").single();
    if (!error && data) return mapIdentity(data);
    if (error?.code !== "23505") break;
    const existing = await supabaseAdmin.from("referrers")
      .select("id,customer_user_id,full_name,phone_e164,referral_code")
      .eq("phone_e164", phone).maybeSingle();
    if (existing.data) return mapIdentity(existing.data);
  }
  throw safeFailure("Referral submission is temporarily unavailable", "REFERRAL_SUBMISSION_FAILED");
};

export const ensureGuestReferrer = async (fullName: string, rawPhone: string) => {
  const phone = normalizePhone(rawPhone);
  const existing = await supabaseAdmin.from("referrers")
    .select("id,customer_user_id,full_name,phone_e164,referral_code")
    .eq("phone_e164", phone).maybeSingle();
  if (existing.error) throw safeFailure("Referral submission is temporarily unavailable", "REFERRAL_SUBMISSION_FAILED");
  if (existing.data) return mapIdentity(existing.data);
  return createGuestIdentity(fullName, phone);
};

export const ensureCustomerReferrer = async (customerUserId: string) => {
  const existing = await supabaseAdmin.from("referrers")
    .select("id,customer_user_id,full_name,phone_e164,referral_code")
    .eq("customer_user_id", customerUserId).maybeSingle();
  if (existing.error) throw safeFailure("Referral service is temporarily unavailable", "REFERRAL_SUBMISSION_FAILED");
  if (existing.data) return mapIdentity(existing.data);

  const profile = await supabaseAdmin.from("profiles")
    .select("id,full_name,first_name,last_name,phone_number,referral_code")
    .eq("id", customerUserId).maybeSingle();
  if (profile.error || !profile.data) throw new AppError("Customer profile not found", 404, "REFERRAL_NOT_FOUND");
  const code = profile.data.referral_code || newReferralCode();
  const normalizedProfilePhone = typeof profile.data.phone_number === "string"
    ? normalizePhone(profile.data.phone_number)
    : null;
  const profilePhone = normalizedProfilePhone && isE164Phone(normalizedProfilePhone)
    ? normalizedProfilePhone
    : null;
  const fullName = profile.data.full_name || [profile.data.first_name, profile.data.last_name].filter(Boolean).join(" ") || "Beryl customer";

  if (profilePhone) {
    const guest = await supabaseAdmin.from("referrers")
      .select("id,customer_user_id,full_name,phone_e164,referral_code")
      .eq("phone_e164", profilePhone).maybeSingle();
    if (guest.error) throw safeFailure("Referral service is temporarily unavailable", "REFERRAL_SUBMISSION_FAILED");
    if (guest.data && !guest.data.customer_user_id) {
      const linked = await supabaseAdmin.from("referrers")
        .update({ customer_user_id: customerUserId, full_name: fullName })
        .eq("id", guest.data.id).is("customer_user_id", null)
        .select("id,customer_user_id,full_name,phone_e164,referral_code").single();
      if (linked.error || !linked.data) throw safeFailure("Referral service is temporarily unavailable", "REFERRAL_SUBMISSION_FAILED");
      if (profile.data.referral_code !== linked.data.referral_code) {
        const profileUpdate = await supabaseAdmin.from("profiles")
          .update({ referral_code: linked.data.referral_code }).eq("id", customerUserId);
        if (profileUpdate.error) throw safeFailure("Referral service is temporarily unavailable", "REFERRAL_SUBMISSION_FAILED");
      }
      return mapIdentity(linked.data);
    }
  }

  if (!profile.data.referral_code) {
    const update = await supabaseAdmin.from("profiles").update({ referral_code: code }).eq("id", customerUserId);
    if (update.error) throw safeFailure("Referral service is temporarily unavailable", "REFERRAL_SUBMISSION_FAILED");
  }
  const inserted = await supabaseAdmin.from("referrers").insert({
    customer_user_id: customerUserId,
    full_name: fullName,
    phone_e164: profilePhone,
    referral_code: code
  }).select("id,customer_user_id,full_name,phone_e164,referral_code").single();
  if (inserted.error || !inserted.data) throw safeFailure("Referral service is temporarily unavailable", "REFERRAL_SUBMISSION_FAILED");
  return mapIdentity(inserted.data);
};

export const resolveReferralTrackingSession = async (token?: string) => {
  if (!token) return null;
  const result = await supabaseAdmin.from("referral_tracking_sessions")
    .select("id,referrer_id,expires_at,revoked_at")
    .eq("token_hash", hashReferralSecret(token)).maybeSingle();
  if (result.error) throw safeFailure("Referral tracking is temporarily unavailable", "REFERRAL_TRACKING_UNAVAILABLE");
  if (!result.data || result.data.revoked_at || new Date(result.data.expires_at).getTime() <= Date.now()) return null;
  return String(result.data.referrer_id);
};

export const authorizedReferralIdentity = async (customerUserId?: string, trackingToken?: string) => {
  if (customerUserId) return ensureCustomerReferrer(customerUserId);
  const referrerId = await resolveReferralTrackingSession(trackingToken);
  if (!referrerId) throw new AppError("Referral tracking session required", 401, "REFERRAL_SESSION_REQUIRED");
  const result = await supabaseAdmin.from("referrers")
    .select("id,customer_user_id,full_name,phone_e164,referral_code")
    .eq("id", referrerId).maybeSingle();
  if (result.error || !result.data) throw new AppError("Referral tracking session required", 401, "REFERRAL_SESSION_REQUIRED");
  return mapIdentity(result.data);
};

export const getReferralContext = async (customerUserId?: string) => {
  if (!customerUserId) return { authenticated: false, referrer: null };
  const identity = await ensureCustomerReferrer(customerUserId);
  return {
    authenticated: true,
    referrer: { fullName: identity.fullName, referralCode: identity.referralCode, referralLink: referralLink(identity.referralCode) }
  };
};

export const resolvePublicReferralCode = async (code: string) => {
  const result = await supabaseAdmin.from("referrers").select("id").eq("referral_code", code).maybeSingle();
  if (result.error) throw safeFailure("Referral link is temporarily unavailable", "REFERRAL_TRACKING_UNAVAILABLE");
  if (!result.data) throw new AppError("Referral link is unavailable", 404, "REFERRAL_CODE_INVALID");
  return { valid: true, referralCode: code };
};

export const submitReferral = async (payload: SubmitReferralInput, customerUserId?: string) => {
  if (!customerUserId && !payload.referrer) {
    throw new AppError("Referrer details are required", 400, "REFERRAL_SUBMISSION_INVALID");
  }
  const identity = customerUserId
    ? await ensureCustomerReferrer(customerUserId)
    : await ensureGuestReferrer(payload.referrer!.fullName, payload.referrer!.phone);
  if (payload.referralCode && payload.referralCode !== identity.referralCode) {
    throw new AppError("Referral code does not match this referrer", 400, "REFERRAL_CODE_INVALID");
  }
  const contactValue = payload.referred.contactMethod === "EMAIL"
    ? payload.referred.email!
    : payload.referred.phone!;
  const inserted = await supabaseAdmin.from("referrals").insert({
    referrer_id: identity.customerUserId,
    referrer_identity_id: identity.id,
    referral_type: payload.purpose === "BUYING" ? "buyer" : "seller",
    referral_code: identity.referralCode,
    referral_link: referralLink(identity.referralCode),
    referred_name: payload.referred.fullName,
    referred_email: payload.referred.email || null,
    referred_phone: payload.referred.phone || null,
    notes: payload.notes || null,
    status: "pending",
    registered_user_id: null,
    purpose: payload.purpose,
    preferred_contact_method: payload.referred.contactMethod,
    referred_full_name: payload.referred.fullName,
    referred_contact_value: contactValue,
    private_referrer_disclosure: payload.privateReferrerDisclosure,
    consent_confirmed_at: new Date().toISOString(),
    lifecycle_status: "NEW",
    reward_amount: null,
    payment_status: "NOT_ELIGIBLE"
  }).select("id,reference_id,purpose,lifecycle_status,created_at").single();
  if (inserted.error || !inserted.data) {
    throw safeFailure("Referral submission is temporarily unavailable", "REFERRAL_SUBMISSION_FAILED");
  }
  return {
    referral: {
      id: inserted.data.id,
      referenceId: inserted.data.reference_id,
      referredFirstName: payload.referred.fullName.split(/\s+/)[0],
      purpose: inserted.data.purpose,
      status: inserted.data.lifecycle_status,
      submittedAt: inserted.data.created_at
    },
    referrer: { referralCode: identity.referralCode, referralLink: referralLink(identity.referralCode) },
    nextAction: customerUserId ? "OPEN_REFERRAL_DASHBOARD" : "REQUEST_TRACKING_CODE",
    trackingAvailable: referralOtpDelivery.available
  };
};

export const requestReferralTrackingOtp = async (
  fullName: string,
  phone: string,
  delivery: ReferralOtpDelivery = referralOtpDelivery
) => {
  if (!delivery.available || env.otpSecret.length < 32) {
    throw safeFailure("Referral tracking by phone is temporarily unavailable", "REFERRAL_TRACKING_UNAVAILABLE");
  }
  const normalizedPhone = normalizePhone(phone);
  if (!isE164Phone(normalizedPhone)) {
    throw new AppError("Enter a valid phone number", 400, "VALIDATION_ERROR");
  }
  const identityResult = await supabaseAdmin.from("referrers")
    .select("id").eq("phone_e164", normalizedPhone).maybeSingle();
  // Keep the public response generic: unknown numbers are never identified.
  if (identityResult.error || !identityResult.data) return { accepted: true, resendAvailableIn: OTP_RESEND_SECONDS };
  const latest = await supabaseAdmin.from("referral_tracking_challenges")
    .select("resend_available_at").eq("referrer_id", identityResult.data.id)
    .is("consumed_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (latest.data && new Date(latest.data.resend_available_at).getTime() > Date.now()) {
    throw new AppError("Please wait before requesting another code", 429, "REFERRAL_OTP_RATE_LIMITED", {
      retryAfter: Math.ceil((new Date(latest.data.resend_available_at).getTime() - Date.now()) / 1000)
    });
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = Date.now();
  const challenge = await supabaseAdmin.from("referral_tracking_challenges").insert({
    referrer_id: identityResult.data.id,
    code_hash: hashReferralSecret(`${code}:${env.otpSecret}`),
    expires_at: new Date(now + OTP_TTL_SECONDS * 1000).toISOString(),
    resend_available_at: new Date(now + OTP_RESEND_SECONDS * 1000).toISOString()
  }).select("id").single();
  if (challenge.error || !challenge.data) throw safeFailure("Referral tracking is temporarily unavailable", "REFERRAL_TRACKING_UNAVAILABLE");
  try {
    await delivery.send({ phone: normalizedPhone, code, expiresInMinutes: OTP_TTL_SECONDS / 60 });
  } catch {
    let removed = false;
    try {
      const result = await supabaseAdmin.from("referral_tracking_challenges")
        .delete().eq("id", challenge.data.id);
      removed = !result.error;
    } catch {
      removed = false;
    }
    if (!removed) {
      try {
        await supabaseAdmin.from("referral_tracking_challenges")
          .update({ consumed_at: new Date().toISOString() }).eq("id", challenge.data.id);
      } catch {
        // Preserve the safe public provider error even if storage cleanup is unavailable.
      }
    }
    throw safeFailure("We could not deliver the referral tracking code", "REFERRAL_OTP_DELIVERY_FAILED", 502);
  }
  return { accepted: true, resendAvailableIn: OTP_RESEND_SECONDS };
};

export const verifyReferralTrackingOtp = async (phone: string, otp: string) => {
  const identity = await supabaseAdmin.from("referrers").select("id").eq("phone_e164", phone).maybeSingle();
  if (identity.error || !identity.data) throw new AppError("The code is invalid or expired", 400, "REFERRAL_OTP_INVALID");
  const challenge = await supabaseAdmin.from("referral_tracking_challenges")
    .select("id,code_hash,attempts,expires_at,consumed_at")
    .eq("referrer_id", identity.data.id).is("consumed_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (challenge.error || !challenge.data) throw new AppError("The code is invalid or expired", 400, "REFERRAL_OTP_INVALID");
  if (new Date(challenge.data.expires_at).getTime() <= Date.now()) {
    throw new AppError("The code has expired", 400, "REFERRAL_OTP_EXPIRED");
  }
  if (challenge.data.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError("Too many incorrect attempts", 429, "REFERRAL_OTP_RATE_LIMITED");
  }
  if (challenge.data.code_hash !== hashReferralSecret(`${otp}:${env.otpSecret}`)) {
    await supabaseAdmin.from("referral_tracking_challenges")
      .update({ attempts: challenge.data.attempts + 1 }).eq("id", challenge.data.id);
    throw new AppError("The code is invalid", 400, "REFERRAL_OTP_INVALID", {
      attemptsRemaining: Math.max(0, OTP_MAX_ATTEMPTS - challenge.data.attempts - 1)
    });
  }
  const token = createReferralTrackingToken();
  const expiresAt = new Date(Date.now() + TRACKING_SESSION_SECONDS * 1000).toISOString();
  const session = await supabaseAdmin.from("referral_tracking_sessions").insert({
    referrer_id: identity.data.id,
    token_hash: hashReferralSecret(token),
    expires_at: expiresAt
  });
  if (session.error) throw safeFailure("Referral tracking is temporarily unavailable", "REFERRAL_TRACKING_UNAVAILABLE");
  await supabaseAdmin.from("referral_tracking_challenges")
    .update({ consumed_at: new Date().toISOString() }).eq("id", challenge.data.id);
  return { trackingToken: token, expiresIn: TRACKING_SESSION_SECONDS };
};

const safeReferralRow = (row: Record<string, unknown>) => {
  const status = row.lifecycle_status as ReferralLifecycle;
  return {
    id: row.id,
    referenceId: row.reference_id,
    referredName: row.referred_full_name,
    purpose: row.purpose,
    contactMethod: row.preferred_contact_method,
    status,
    statusLabel: referralStatusLabel(status),
    rewardAmount: row.reward_amount === null ? null : Number(row.reward_amount),
    paymentStatus: row.payment_status,
    submittedAt: row.created_at
  };
};

export const getCanonicalReferralDashboard = async (
  customerUserId: string | undefined,
  trackingToken: string | undefined,
  page: number,
  limit: number
) => {
  const identity = await authorizedReferralIdentity(customerUserId, trackingToken);
  const from = (page - 1) * limit;
  const list = await supabaseAdmin.from("referrals")
    .select("id,reference_id,referred_full_name,purpose,preferred_contact_method,lifecycle_status,reward_amount,payment_status,created_at", { count: "exact" })
    .eq("referrer_identity_id", identity.id).order("created_at", { ascending: false })
    .range(from, from + limit - 1);
  if (list.error) throw safeFailure("Referral dashboard is temporarily unavailable", "REFERRAL_TRACKING_UNAVAILABLE");
  const totals = await supabaseAdmin.from("referrals")
    .select("lifecycle_status,reward_amount,payment_status")
    .eq("referrer_identity_id", identity.id);
  if (totals.error) throw safeFailure("Referral dashboard is temporarily unavailable", "REFERRAL_TRACKING_UNAVAILABLE");
  const rows = totals.data || [];
  const earned = rows.reduce((sum, row) => row.lifecycle_status === "COMPLETED" && row.reward_amount !== null ? sum + Number(row.reward_amount) : sum, 0);
  const outstanding = rows.reduce((sum, row) => row.payment_status === "OUTSTANDING" && row.reward_amount !== null ? sum + Number(row.reward_amount) : sum, 0);
  return {
    referrer: { fullName: identity.fullName, referralCode: identity.referralCode, referralLink: referralLink(identity.referralCode) },
    summary: { referralCount: rows.length, completedCount: rows.filter((row) => row.lifecycle_status === "COMPLETED").length, earnedAmount: earned, outstandingAmount: outstanding },
    referrals: (list.data || []).map((row) => safeReferralRow(row)),
    pagination: { page, limit, total: list.count || 0, totalPages: Math.ceil((list.count || 0) / limit) }
  };
};

export const getBankDirectory = () => ({
  banks: REFERRAL_BANK_DIRECTORY,
  authoritativeCompleteDirectory: false,
  accountNameResolutionAvailable: false
});

export const getPayoutDetails = async (customerUserId?: string, trackingToken?: string) => {
  const identity = await authorizedReferralIdentity(customerUserId, trackingToken);
  const result = await supabaseAdmin.from("referrer_payout_details")
    .select("bank_code,bank_name,account_name,account_number_last4,updated_at")
    .eq("referrer_id", identity.id).maybeSingle();
  if (result.error) throw safeFailure("Payout details are temporarily unavailable", "PAYOUT_DETAILS_UNAVAILABLE");
  if (!result.data) return { payoutDetails: null };
  return { payoutDetails: {
    bankCode: result.data.bank_code,
    bankName: result.data.bank_name,
    accountName: result.data.account_name,
    maskedAccountNumber: `••••••${result.data.account_number_last4}`,
    updatedAt: result.data.updated_at
  } };
};

export const savePayoutDetails = async (payload: PayoutDetailsInput, customerUserId?: string, trackingToken?: string) => {
  const identity = await authorizedReferralIdentity(customerUserId, trackingToken);
  const bank = referralBankByCode(payload.bankCode);
  if (!bank) throw new AppError("Select a supported bank", 400, "PAYOUT_DETAILS_INVALID");
  const encrypted = encryptAccountNumber(payload.accountNumber);
  const result = await supabaseAdmin.from("referrer_payout_details").upsert({
    referrer_id: identity.id,
    bank_code: bank.code,
    bank_name: bank.name,
    account_name: payload.accountName,
    account_number_ciphertext: encrypted.ciphertext,
    account_number_iv: encrypted.iv,
    account_number_auth_tag: encrypted.authTag,
    account_number_last4: payload.accountNumber.slice(-4),
    updated_at: new Date().toISOString()
  }, { onConflict: "referrer_id" });
  if (result.error) throw safeFailure("Payout details are temporarily unavailable", "PAYOUT_DETAILS_UNAVAILABLE");
  return getPayoutDetails(customerUserId, trackingToken);
};

// Legacy wrappers retained so existing integrations compile while the canonical
// dashboard and stable /r/:code links replace broad-row responses.
export const getReferralDashboard = async (userId: string) => getCanonicalReferralDashboard(userId, undefined, 1, 10);
export const getMyReferralList = async (userId: string, query: Record<string, unknown>) => {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(20, Math.max(1, Number(query.limit || 10)));
  const dashboard = await getCanonicalReferralDashboard(userId, undefined, page, limit);
  return { referrals: dashboard.referrals, pagination: dashboard.pagination };
};
export const generatePropertyReferralLink = async (userId: string, propertyId: string) => {
  const property = await supabaseAdmin.from("properties").select("id").eq("id", propertyId).maybeSingle();
  if (property.error || !property.data) throw new AppError("Property not found", 404, "REFERRAL_NOT_FOUND");
  const identity = await ensureCustomerReferrer(userId);
  return { property_id: propertyId, referral_code: identity.referralCode, referral_link: `${PUBLIC_WEB_URL}/marketplace/${propertyId}?ref=${identity.referralCode}` };
};
export const generateSellerReferralLink = async (userId: string) => {
  const identity = await ensureCustomerReferrer(userId);
  return { referral_code: identity.referralCode, referral_link: referralLink(identity.referralCode) };
};
export const trackReferral = async (payload: Record<string, unknown>) => {
  const code = String(payload.referral_code);
  const identityResult = await supabaseAdmin.from("referrers")
    .select("id,customer_user_id,full_name,phone_e164,referral_code").eq("referral_code", code).maybeSingle();
  if (identityResult.error || !identityResult.data) throw new AppError("Invalid referral code", 404, "REFERRAL_CODE_INVALID");
  const referredName = typeof payload.referred_name === "string" ? payload.referred_name : "Referral contact";
  const referredEmail = typeof payload.referred_email === "string" ? payload.referred_email : undefined;
  const referredPhone = typeof payload.referred_phone === "string" ? payload.referred_phone : undefined;
  if (!referredEmail && !referredPhone) throw new AppError("A referred contact is required", 400, "REFERRAL_SUBMISSION_INVALID");
  return submitReferral({
    referred: {
      fullName: referredName,
      contactMethod: referredEmail ? "EMAIL" : "CALL",
      ...(referredEmail ? { email: referredEmail } : { phone: normalizePhone(referredPhone!) })
    },
    purpose: payload.referral_type === "seller" ? "SELLING" : "BUYING",
    notes: typeof payload.notes === "string" ? payload.notes : undefined,
    privateReferrerDisclosure: false,
    consent: true,
    referralCode: code,
    referrer: { fullName: String(identityResult.data.full_name), phone: String(identityResult.data.phone_e164 || "+2348000000000") }
  }, typeof identityResult.data.customer_user_id === "string" ? identityResult.data.customer_user_id : undefined);
};
export const updateReferralStatus = async (referralId: string, payload: Record<string, unknown>) => {
  const status = String(payload.status);
  const lifecycle = ({ pending: "NEW", qualified: "CONTACTED", converted: "COMPLETED", rejected: "LOST" } as const)[status as "pending"];
  const update: Record<string, unknown> = { status, lifecycle_status: lifecycle };
  if (status === "converted") {
    update.completed_at = new Date().toISOString();
    if (typeof payload.earned_commission === "number") {
      update.earned_commission = payload.earned_commission;
      update.reward_amount = payload.earned_commission;
      update.payment_status = "OUTSTANDING";
    }
  }
  const result = await supabaseAdmin.from("referrals").update(update).eq("id", referralId)
    .select("id,reference_id,lifecycle_status,reward_amount,payment_status").maybeSingle();
  if (result.error || !result.data) throw new AppError("Referral not found", 404, "REFERRAL_NOT_FOUND");
  return result.data;
};
