export type ReferralPurpose = "BUYING" | "SELLING";
export type ReferralContactMethod = "WHATSAPP" | "CALL" | "EMAIL";
export type ReferralLifecycle = "NEW" | "CONTACTED" | "IN_PROGRESS" | "COMPLETED" | "LOST";
export type ReferralPaymentStatus = "NOT_ELIGIBLE" | "OUTSTANDING" | "PAID";

export type ReferralContext = {
  authenticated: boolean;
  referrer: null | { fullName: string; referralCode: string; referralLink: string };
};

export type DirectReferralRequest = {
  referrer?: { fullName: string; phone: string };
  referred: {
    fullName: string;
    contactMethod: ReferralContactMethod;
    phone?: string;
    email?: string;
  };
  purpose: ReferralPurpose;
  notes?: string;
  privateReferrerDisclosure: boolean;
  consent: true;
  referralCode?: string;
};

export type DirectReferralResult = {
  referral: {
    id: string;
    referenceId: string;
    referredFirstName: string;
    purpose: ReferralPurpose;
    status: "NEW";
    submittedAt: string;
  };
  referrer: { referralCode: string; referralLink: string };
  nextAction: "OPEN_REFERRAL_DASHBOARD" | "REQUEST_TRACKING_CODE";
  trackingAvailable: boolean;
};

export type ReferralDashboardItem = {
  id: string;
  referenceId: string;
  referredName: string;
  purpose: ReferralPurpose;
  contactMethod: ReferralContactMethod;
  status: ReferralLifecycle;
  statusLabel: string;
  rewardAmount: number | null;
  paymentStatus: ReferralPaymentStatus;
  submittedAt: string;
};

export type ReferralDashboard = {
  referrer: { fullName: string; referralCode: string; referralLink: string };
  summary: {
    referralCount: number;
    completedCount: number;
    earnedAmount: number;
    outstandingAmount: number;
  };
  referrals: ReferralDashboardItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type ReferralBankDirectory = {
  banks: { code: string; name: string }[];
  authoritativeCompleteDirectory: false;
  accountNameResolutionAvailable: false;
};

export type ReferralPayoutDetails = {
  payoutDetails: null | {
    bankCode: string;
    bankName: string;
    accountName: string;
    maskedAccountNumber: string;
    updatedAt: string;
  };
};

export type ReferralPayoutRequest = {
  bankCode: string;
  accountNumber: string;
  accountName: string;
};

export type ReferralTrackingRequestResult = { accepted: true; resendAvailableIn: number };
export type ReferralTrackingVerifyResult = { trackingToken: string; expiresIn: number };
