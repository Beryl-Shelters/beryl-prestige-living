import { basename } from "node:path";
import { supabaseAdmin } from "../../config/supabase";
import { AppError } from "../../utils/AppError";
import {
  createReferralPaymentReceiptAccessUrl,
  deleteReferralPaymentReceipt,
  uploadReferralPaymentReceipt
} from "../../utils/cloudinary";
import { decryptAccountNumber } from "../referral/referral.security";
import type { AdminReferrerListInput } from "./admin-referrers.validators";

type ReferralRow = {
  id: string; reference_id: string; purpose: string; referred_full_name: string;
  lifecycle_status: string; reward_amount: number | string | null; payment_status: string;
  created_at: string; completed_at: string | null;
};
type PaymentRow = {
  id: string; referral_id: string; amount: number | string; status: string;
  receipt_mime_type: string | null; receipt_original_name: string | null;
  receipt_size_bytes: number | null; paid_at: string | null; recorded_by_admin_id: string | null;
};
type PayoutPaymentRow = {
  bank_name: string; account_name: string; account_number_last4: string;
  account_number_ciphertext?: string; account_number_iv?: string; account_number_auth_tag?: string;
};

const unavailable = () => new AppError("Admin referrers are temporarily unavailable", 503, "ADMIN_REFERRERS_UNAVAILABLE");
const money = (value: number | string | null | undefined) => Number(value ?? 0);
const payoutStatus = (onFile: boolean, outstanding: number) => onFile ? "ON_FILE" : outstanding > 0 ? "MISSING" : "NOT_NEEDED";

export const listReferrers = async (input: AdminReferrerListInput) => {
  const { data, error } = await supabaseAdmin.rpc("list_admin_referrers", {
    p_query: input.q ?? null,
    p_payment_filter: input.payment,
    p_sort: input.sort,
    p_page: input.page,
    p_limit: input.limit
  });
  if (error || !data) throw unavailable();
  return data;
};

const loadReferrer = async (referrerId: string) => {
  const { data, error } = await supabaseAdmin.from("referrers")
    .select("id,customer_user_id,full_name,phone_e164,referral_code,created_at")
    .eq("id", referrerId).maybeSingle();
  if (error) throw unavailable();
  if (!data) throw new AppError("Referrer not found", 404, "REFERRER_NOT_FOUND");
  return data;
};

export const getReferrerDetail = async (referrerId: string) => {
  const referrer = await loadReferrer(referrerId);
  const [profileResult, payoutResult, referralsResult] = await Promise.all([
    referrer.customer_user_id
      ? supabaseAdmin.from("profiles").select("id,full_name,email,phone_number").eq("id", referrer.customer_user_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabaseAdmin.from("referrer_payout_details").select("bank_name,account_name,account_number_last4,updated_at").eq("referrer_id", referrerId).maybeSingle(),
    supabaseAdmin.from("referrals").select("id,reference_id,purpose,referred_full_name,lifecycle_status,reward_amount,payment_status,created_at,completed_at").eq("referrer_identity_id", referrerId).order("created_at", { ascending: false })
  ]);
  if (profileResult.error || payoutResult.error || referralsResult.error) throw unavailable();
  const referrals = (referralsResult.data ?? []) as ReferralRow[];
  const referralIds = referrals.map((item) => item.id);
  const paymentResult = referralIds.length
    ? await supabaseAdmin.from("referral_payments").select("id,referral_id,amount,status,receipt_mime_type,receipt_original_name,receipt_size_bytes,paid_at,recorded_by_admin_id").in("referral_id", referralIds).eq("status", "PAID")
    : { data: [], error: null };
  if (paymentResult.error) throw unavailable();
  const payments = new Map(((paymentResult.data ?? []) as PaymentRow[]).map((item) => [item.referral_id, item]));
  const completed = referrals.filter((item) => item.lifecycle_status === "COMPLETED");
  const earned = completed.reduce((sum, item) => sum + money(item.reward_amount), 0);
  const outstanding = completed.filter((item) => item.payment_status === "OUTSTANDING").reduce((sum, item) => sum + money(item.reward_amount), 0);
  const payout = payoutResult.data;
  return {
    identity: {
      id: referrer.id,
      customerId: referrer.customer_user_id,
      fullName: referrer.full_name,
      phone: referrer.phone_e164,
      email: profileResult.data?.email ?? null,
      referralCode: referrer.referral_code,
      joinedAt: referrer.created_at,
      identityType: referrer.customer_user_id ? "CUSTOMER_LINKED" : "REFERRAL_ONLY"
    },
    linkedCustomer: profileResult.data ? { id: profileResult.data.id, fullName: profileResult.data.full_name, email: profileResult.data.email } : null,
    summary: { referrals: referrals.length, completed: completed.length, earnedAmount: earned, outstandingAmount: outstanding },
    payout: payout ? { status: "ON_FILE", bankName: payout.bank_name, accountName: payout.account_name, maskedAccountNumber: `•••• ${payout.account_number_last4}`, updatedAt: payout.updated_at } : { status: payoutStatus(false, outstanding), bankName: null, accountName: null, maskedAccountNumber: null, updatedAt: null },
    referrals: referrals.map((item) => {
      const payment = payments.get(item.id);
      return {
        id: item.id,
        referenceId: item.reference_id,
        referredFullName: item.referred_full_name,
        purpose: item.purpose,
        createdAt: item.created_at,
        completedAt: item.completed_at,
        lifecycleStatus: item.lifecycle_status,
        rewardAmount: item.lifecycle_status === "COMPLETED" && item.reward_amount !== null ? money(item.reward_amount) : null,
        paymentStatus: item.payment_status,
        payment: payment ? { id: payment.id, amount: money(payment.amount), paidAt: payment.paid_at, receipt: { fileName: payment.receipt_original_name, mimeType: payment.receipt_mime_type, sizeBytes: payment.receipt_size_bytes }, recordedByAdminId: payment.recorded_by_admin_id } : null
      };
    })
  };
};

const loadPaymentRows = async (referrerId: string, referralId: string, includeCiphertext: boolean) => {
  const referrer = await loadReferrer(referrerId);
  const [referralResult, payoutResult] = await Promise.all([
    supabaseAdmin.from("referrals").select("id,referrer_identity_id,reference_id,referred_full_name,lifecycle_status,reward_amount,payment_status").eq("id", referralId).eq("referrer_identity_id", referrerId).maybeSingle(),
    supabaseAdmin.from("referrer_payout_details").select(includeCiphertext ? "bank_name,account_name,account_number_last4,account_number_ciphertext,account_number_iv,account_number_auth_tag" : "bank_name,account_name,account_number_last4").eq("referrer_id", referrerId).maybeSingle()
  ]);
  if (referralResult.error || payoutResult.error) throw unavailable();
  if (!referralResult.data) throw new AppError("Referral not found", 404, "REFERRAL_NOT_FOUND");
  const referral = referralResult.data;
  if (referral.payment_status === "PAID") throw new AppError("Referral has already been paid", 409, "REFERRAL_ALREADY_PAID");
  if (referral.lifecycle_status !== "COMPLETED" || referral.payment_status !== "OUTSTANDING" || money(referral.reward_amount) <= 0) throw new AppError("Referral is not eligible for payment", 409, "REFERRAL_NOT_PAYABLE");
  if (!payoutResult.data) throw new AppError("Referrer payout details are required", 409, "PAYOUT_DETAILS_REQUIRED");
  return { referrer, referral, payout: payoutResult.data as unknown as PayoutPaymentRow };
};

export const getPaymentPreparation = async (referrerId: string, referralId: string) => {
  const { referrer, referral, payout } = await loadPaymentRows(referrerId, referralId, true);
  const secret = payout as PayoutPaymentRow & { account_number_ciphertext: string; account_number_iv: string; account_number_auth_tag: string };
  try {
    return {
      referrer: { id: referrer.id, fullName: referrer.full_name },
      referral: { id: referral.id, referenceId: referral.reference_id, referredFullName: referral.referred_full_name },
      amount: money(referral.reward_amount),
      payout: { bankName: payout.bank_name, accountName: payout.account_name, accountNumber: decryptAccountNumber({ ciphertext: secret.account_number_ciphertext, iv: secret.account_number_iv, authTag: secret.account_number_auth_tag }) }
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Referrer payout details are required", 409, "PAYOUT_DETAILS_REQUIRED");
  }
};

const hasValidSignature = (file: Express.Multer.File) => {
  if (file.mimetype === "application/pdf") return file.buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (file.mimetype === "image/png") return file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return file.mimetype === "image/jpeg" && file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[file.buffer.length - 2] === 0xff && file.buffer[file.buffer.length - 1] === 0xd9;
};

export const markReferralPaid = async (referrerId: string, referralId: string, adminId: string, file: Express.Multer.File) => {
  if (!hasValidSignature(file)) throw new AppError("Payment receipt file is invalid", 400, "PAYMENT_RECEIPT_INVALID");
  await loadPaymentRows(referrerId, referralId, false);
  let uploaded: { public_id: string } | null = null;
  try {
    uploaded = await uploadReferralPaymentReceipt(file.buffer);
    const cleanName = basename(file.originalname).replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 180) || "payment-receipt";
    const { data, error } = await supabaseAdmin.rpc("record_admin_referral_payment", {
      p_referral_id: referralId,
      p_referrer_id: referrerId,
      p_admin_id: adminId,
      p_receipt_public_id: uploaded.public_id,
      p_receipt_mime_type: file.mimetype,
      p_receipt_original_name: cleanName,
      p_receipt_size_bytes: file.size
    });
    const result = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
    if (error || !result) throw new AppError("Referral payment could not be recorded", 503, "REFERRAL_PAYMENT_FAILED");
    if (result.outcome !== "PAID") {
      const outcomes: Record<string, readonly [string, number, string]> = {
        NOT_FOUND: ["Referral not found", 404, "REFERRAL_NOT_FOUND"],
        ALREADY_PAID: ["Referral has already been paid", 409, "REFERRAL_ALREADY_PAID"],
        NOT_PAYABLE: ["Referral is not eligible for payment", 409, "REFERRAL_NOT_PAYABLE"],
        PAYOUT_REQUIRED: ["Referrer payout details are required", 409, "PAYOUT_DETAILS_REQUIRED"],
        RECEIPT_INVALID: ["Payment receipt file is invalid", 400, "PAYMENT_RECEIPT_INVALID"]
      };
      const mapped = outcomes[String(result.outcome)] ?? ["Referral payment could not be recorded", 503, "REFERRAL_PAYMENT_FAILED"];
      throw new AppError(mapped[0], mapped[1], mapped[2]);
    }
    const amount = typeof result.amount === "number" || typeof result.amount === "string" ? money(result.amount) : 0;
    return { payment: { id: result.payment_id, referralId: result.referral_id, referrerId: result.referrer_id, referenceId: result.reference_id, amount, status: result.payment_status, paidAt: result.paid_at, recordedByAdminId: result.recorded_by_admin_id } };
  } catch (error) {
    if (uploaded) await deleteReferralPaymentReceipt(uploaded.public_id).catch(() => undefined);
    if (error instanceof AppError) throw error;
    throw new AppError("Referral payment could not be recorded", 503, "REFERRAL_PAYMENT_FAILED");
  }
};

export const createReceiptAccess = async (referrerId: string, referralId: string) => {
  await loadReferrer(referrerId);
  const { data, error } = await supabaseAdmin.from("referral_payments")
    .select("receipt_storage_public_id,receipt_original_name,receipt_mime_type")
    .eq("referral_id", referralId).eq("status", "PAID").maybeSingle();
  if (error) throw unavailable();
  if (!data?.receipt_storage_public_id) throw new AppError("Payment receipt access failed", 404, "PAYMENT_RECEIPT_ACCESS_FAILED");
  const { data: referral, error: referralError } = await supabaseAdmin.from("referrals").select("id").eq("id", referralId).eq("referrer_identity_id", referrerId).maybeSingle();
  if (referralError) throw unavailable();
  if (!referral) throw new AppError("Referral not found", 404, "REFERRAL_NOT_FOUND");
  try {
    const expiresAt = Math.floor(Date.now() / 1000) + 300;
    return { url: createReferralPaymentReceiptAccessUrl(data.receipt_storage_public_id, expiresAt), expiresAt: new Date(expiresAt * 1000).toISOString(), fileName: data.receipt_original_name, mimeType: data.receipt_mime_type };
  } catch {
    throw new AppError("Payment receipt access failed", 503, "PAYMENT_RECEIPT_ACCESS_FAILED");
  }
};
