import type { ApiTransport, ListingStatus } from "./listings-api";

export type RevenuePoint = {
  label: string;
  amount: number;
};

export type DashboardOverview = {
  customer: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    account_type: string | null;
    profile_type: string | null;
    profile_image_url: string | null;
  };
  summary: {
    total_investments: number;
    properties_owned: number;
    referral_earnings: number;
    new_messages: number;
  };
  revenue: {
    monthly: RevenuePoint[];
    yearly: RevenuePoint[];
  };
  recent_messages: { id: string; subject: string }[];
  recent_property_listings: {
    id: string;
    title: string;
    status: ListingStatus;
    priceMinor: number;
    imageUrl: string | null;
    updatedAt: string;
  }[];
};

export type CustomerAnalytics = {
  year: number;
  categoryPerformance: {
    month: number;
    label: string;
    buy: number;
    sell: number;
    referral: number;
  }[];
  listingsOverview: {
    total: number;
    listed: { count: number; percentage: number };
    pending: { count: number; percentage: number };
    rejected: { count: number; percentage: number };
    unlisted?: { count: number; percentage: number };
  };
  bedrooms: Record<1 | 2 | 3 | 4 | 5 | 6, number>;
  propertyTypes: { commercial: number; residential: number };
};

export type PurchasedProperty = {
  propertyCode: string;
  title: string;
  state: string;
  propertyType: "Residential" | "Commercial";
  propertySubtype: string | null;
  priceMinor: number;
  closedAt: string;
};

export type PurchasedPropertiesPage = {
  items: PurchasedProperty[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function createDashboardApi(client?: ApiTransport) {
  const getClient = (): ApiTransport => {
    if (client) return client;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("./api-client") as typeof import("./api-client")).apiClient;
  };

  return {
    async getOverview(): Promise<DashboardOverview> {
      return getClient().request<DashboardOverview>("/api/v1/dashboard/overview");
    },

    async getAnalytics(params?: { q?: string; year?: number }): Promise<CustomerAnalytics> {
      const query = new URLSearchParams();
      if (params?.q) query.set("q", params.q.trim());
      if (params?.year) query.set("year", String(params.year));
      const qs = query.toString();
      return getClient().request<CustomerAnalytics>(
        `/api/v1/dashboard/analytics${qs ? `?${qs}` : ""}`
      );
    },

    async getPurchasedProperties(params?: {
      q?: string;
      page?: number;
    }): Promise<PurchasedPropertiesPage> {
      const query = new URLSearchParams();
      if (params?.q) query.set("q", params.q.trim());
      if (params?.page) query.set("page", String(params.page));
      const qs = query.toString();
      return getClient().request<PurchasedPropertiesPage>(
        `/api/v1/dashboard/properties${qs ? `?${qs}` : ""}`
      );
    },
  };
}

export const dashboardApi = createDashboardApi();
