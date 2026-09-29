import type { ApiTransport } from "./listings-api";

export const referralCommissionBasisPoints = 200; // Strictly 2%

export type ReferralItem = {
  id: string;
  referralType: "PROPERTY" | "SELLER";
  saleAmount: number;
  propertyCode: string;
  earnings: number;
  status: "COMPLETED";
  completedAt: string;
  paymentState: "OUTSTANDING" | "PARTIALLY_PAID" | "PAID";
  paidMinor: number;
  paidAt: string | null;
};

export type ReferralSummary = {
  availableBalance: number;
  totalEarnings: number;
  paid: number;
  pendingWithdrawals: number;
  grossOutstanding: number;
  bankComplete: boolean;
  referrals: number;
  propertiesSold: number;
};

export type ReferralPage = {
  program: {
    commissionRateBasisPoints: number;
  };
  summary: ReferralSummary;
  items: ReferralItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type CreatedReferral = {
  id: string;
  referralType: "PROPERTY" | "SELLER";
  propertyCode: string | null;
  referralUrl: string;
};

export type WithdrawalStatus = "PENDING" | "PROCESSING" | "PAID" | "REJECTED" | "CANCELLED";

export type WithdrawalItem = {
  id: string;
  amountMinor: number;
  status: WithdrawalStatus;
  requestedAt: string;
  processingStartedAt: string | null;
  paidAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  cancelledAt: string | null;
  paymentId: string | null;
};

export type WithdrawalBalance = {
  totalEarnedMinor: number;
  totalPaidMinor: number;
  grossOutstandingMinor: number;
  pendingMinor: number;
  availableMinor: number;
  minimumMinor: number;
};

export type WithdrawalBank = {
  complete: boolean;
  accountName: string | null;
  bankName: string | null;
  maskedAccountNumber: string | null;
};

export type WithdrawalPage = {
  balance: WithdrawalBalance;
  bank: WithdrawalBank;
  items: WithdrawalItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function calculateQuickPercentage(availableMinor: number, percent: number): number {
  if (percent === 100) return availableMinor;
  return Math.floor(availableMinor / 100) * percent + Math.floor(((availableMinor % 100) * percent) / 100);
}

export function createReferralsApi(client?: ApiTransport) {
  const getClient = (): ApiTransport => {
    if (client) return client;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("./api-client") as typeof import("./api-client")).apiClient;
  };

  return {
    async list(page = 1): Promise<ReferralPage> {
      return getClient().request<ReferralPage>(
        `/api/v1/dashboard/referrals?${new URLSearchParams({ page: String(page) })}`
      );
    },

    async create(input: { type: "SELLER" } | { type: "PROPERTY"; listingId: string }): Promise<CreatedReferral> {
      return getClient().request<CreatedReferral>("/api/v1/dashboard/referrals", {
        method: "POST",
        body: input,
      });
    },

    async createPublicProperty(propertyCode: string): Promise<CreatedReferral> {
      return getClient().request<CreatedReferral>("/api/v1/dashboard/referrals/public-property", {
        method: "POST",
        body: { propertyCode },
      });
    },

    async withdrawals(page = 1): Promise<WithdrawalPage> {
      return getClient().request<WithdrawalPage>(
        `/api/v1/dashboard/referrals/withdrawals?${new URLSearchParams({ page: String(page) })}`
      );
    },

    async requestWithdrawal(requestId: string, amountMinor: number): Promise<{ id: string }> {
      return getClient().request<{ id: string }>("/api/v1/dashboard/referrals/withdrawals", {
        method: "POST",
        body: { requestId, amountMinor },
      });
    },

    async cancelWithdrawal(id: string): Promise<void> {
      return getClient().request<void>(
        `/api/v1/dashboard/referrals/withdrawals/${encodeURIComponent(id)}/cancel`,
        {
          method: "POST",
          body: {},
        }
      );
    },
  };
}

export const referralsApi = createReferralsApi();
