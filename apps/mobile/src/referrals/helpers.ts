import type { ReferralLifecycle, ReferralPaymentStatus, ReferralPurpose } from "@/types/referrals";

export const referralRoutes = {
  landing: "/refer",
  dashboard: "/referrals",
  newReferral: "/referrals/new",
  tracking: "/referrals/track",
  bankDetails: "/referrals/bank-details"
} as const;

export const referralStatus = (status: ReferralLifecycle) => ({
  NEW: { label: "New", tone: "new", message: "We'll be in touch with them shortly." },
  CONTACTED: { label: "In Progress", tone: "progress", message: "Our team is working with them." },
  IN_PROGRESS: { label: "In Progress", tone: "progress", message: "Our team is working with them." },
  COMPLETED: { label: "Completed", tone: "complete", message: "Their property journey is complete." },
  LOST: { label: "Didn't proceed", tone: "lost", message: "" }
})[status];

export const paymentLabel = (status: ReferralPaymentStatus) => ({
  NOT_ELIGIBLE: "Not eligible yet",
  OUTSTANDING: "Not paid yet",
  PAID: "Paid"
})[status];

export const purposeLabel = (purpose: ReferralPurpose) => purpose === "BUYING" ? "Buying" : "Selling";
export const formatReferralMoney = (value: number) => `₦${Math.max(0, value).toLocaleString("en-NG")}`;
export const formatReferralDate = (value: string) => new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "short" }).format(new Date(value));
export const referralInitials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "BR";

export const referralErrorMessage = (code?: string) => ({
  REFERRAL_CODE_INVALID: "This referral link is no longer available.",
  REFERRAL_SUBMISSION_INVALID: "Check the referral details and try again.",
  REFERRAL_SUBMISSION_FAILED: "We could not submit this referral. Your details are still here so you can retry.",
  REFERRAL_TRACKING_UNAVAILABLE: "Referral tracking codes are temporarily unavailable. Keep your referral reference safe and try again later.",
  REFERRAL_OTP_DELIVERY_FAILED: "We could not send the WhatsApp code. Please try again.",
  REFERRAL_OTP_INVALID: "That code is not correct. Check it and try again.",
  REFERRAL_OTP_EXPIRED: "That code has expired. Request a new code.",
  REFERRAL_OTP_RATE_LIMITED: "Please wait before requesting or trying another code.",
  REFERRAL_SESSION_REQUIRED: "Verify your referral phone number to continue.",
  PAYOUT_DETAILS_INVALID: "Check your bank and account details and try again.",
  PAYOUT_DETAILS_UNAVAILABLE: "Payment details are temporarily unavailable. Please try again."
}[code ?? ""] ?? "Something went wrong. Please check your connection and try again.");
