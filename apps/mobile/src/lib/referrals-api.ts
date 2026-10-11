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
  totalEarned: number;
  totalPaid: number;
  unpaidBalance: number;
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

  };
}

export const referralsApi = createReferralsApi();
