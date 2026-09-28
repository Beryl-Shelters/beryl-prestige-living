import { adminApi } from "./api";

export type CustomerAccountType = "INVESTOR" | "PROPERTY_DEVELOPER" | "LANDLORD" | "REGISTERED_AGENT" | "FREELANCE_AGENT";
export type CustomerProfileType = "PERSONAL" | "BUSINESS";
export type CustomerKycStatus = "NOT_SUBMITTED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
export type CustomerDirectoryAccountType = "ALL" | CustomerAccountType;
export type CustomerDirectoryProfileType = "ALL" | CustomerProfileType;
export type CustomerDirectorySort = "NEWEST" | "OLDEST" | "NAME_ASC" | "NAME_DESC";

export type CustomerDirectoryItem = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  joinedAt: string;
  accountType: CustomerAccountType | null;
  profileType: CustomerProfileType | null;
  hasPropertyActivity: boolean;
  hasListingActivity: boolean;
  hasReferralActivity: boolean;
  referralCode: string | null;
  kycStatus: CustomerKycStatus;
};

export type CustomerDirectoryPage = {
  summary: {
    totalUsers: number;
    propertyActivityCustomers: number;
    listingActivityCustomers: number;
    referralActivityCustomers: number;
  };
  items: CustomerDirectoryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type CustomerDetail = CustomerDirectoryItem & {
  propertyActivity: {
    hasActivity: boolean;
    firstActivityAt: string | null;
    savedProperties: number;
    completedPurchases: number;
  };
  listingActivity: {
    hasActivity: boolean;
    firstListingAt: string | null;
    listingCount: number;
  };
  referralActivity: {
    hasActivity: boolean;
    firstReferralLinkAt: string | null;
    referralLinkCount: number;
    referralCode: string | null;
  };
  businessInformation: {
    exists: boolean;
    companyName: string | null;
    companyAddress: string | null;
  };
};

export function listAdminCustomers(
  query: { search: string; accountType: CustomerDirectoryAccountType; profileType: CustomerDirectoryProfileType; sort: CustomerDirectorySort; page: number },
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    search: query.search,
    accountType: query.accountType,
    profileType: query.profileType,
    sort: query.sort,
    page: String(query.page),
    pageSize: "6",
  });
  return adminApi<CustomerDirectoryPage>(`/customers?${params}`, signal ? { signal } : undefined);
}

export async function getAdminCustomer(customerId: string, signal?: AbortSignal) {
  const data = await adminApi<{ customer: CustomerDetail }>(`/customers/${encodeURIComponent(customerId)}`, signal ? { signal } : undefined);
  return data.customer;
}
