import { request } from "@/api/client";
import { referralTrackingSession } from "@/store/referral-flow";
import type { ApiEnvelope } from "@/types/auth";
import type {
  DirectReferralRequest,
  DirectReferralResult,
  ReferralBankDirectory,
  ReferralContext,
  ReferralDashboard,
  ReferralPayoutDetails,
  ReferralPayoutRequest,
  ReferralTrackingRequestResult,
  ReferralTrackingVerifyResult
} from "@/types/referrals";

type CustomerRequester = <T>(path: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown) => Promise<ApiEnvelope<T>>;

const trackingHeaders = async () => {
  const token = await referralTrackingSession.restore();
  return token ? { "X-Referral-Tracking-Token": token } : undefined;
};

export const getReferralContext = (accessToken?: string | null) => request<ReferralContext>("/referrals/context", "GET", undefined, accessToken ?? undefined);
export const submitDirectReferral = (payload: DirectReferralRequest, accessToken?: string | null) => request<DirectReferralResult>("/referrals", "POST", payload, accessToken ?? undefined);
export const requestReferralTracking = (fullName: string, phone: string) => request<ReferralTrackingRequestResult>("/referrals/tracking/request", "POST", { fullName, phone });
export const verifyReferralTracking = (phone: string, otp: string) => request<ReferralTrackingVerifyResult>("/referrals/tracking/verify", "POST", { phone, otp });
export const getReferralDashboard = async (customerRequester?: CustomerRequester, page = 1) => customerRequester
  ? customerRequester<ReferralDashboard>(`/referrals/dashboard?page=${page}&limit=10`, "GET")
  : request<ReferralDashboard>(`/referrals/dashboard?page=${page}&limit=10`, "GET", undefined, undefined, await trackingHeaders());
export const getReferralBanks = () => request<ReferralBankDirectory>("/referrals/banks", "GET");
export const getReferralPayout = async (customerRequester?: CustomerRequester) => customerRequester
  ? customerRequester<ReferralPayoutDetails>("/referrals/payout-details", "GET")
  : request<ReferralPayoutDetails>("/referrals/payout-details", "GET", undefined, undefined, await trackingHeaders());
export const saveReferralPayout = async (payload: ReferralPayoutRequest, customerRequester?: CustomerRequester) => customerRequester
  ? customerRequester<ReferralPayoutDetails>("/referrals/payout-details", "PUT", payload)
  : request<ReferralPayoutDetails>("/referrals/payout-details", "PUT", payload, undefined, await trackingHeaders());
