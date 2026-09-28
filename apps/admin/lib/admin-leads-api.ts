import { adminApi } from "./api";

export type LeadStage = "NEW" | "CONTACTED" | "WON" | "LOST";
export type LeadSource = "REAL_ESTATE_INQUIRY" | "BUY_ASSISTANCE" | "PROPERTY_VIEWING";

export type LeadDirectoryItem = {
  publicId: string;
  stage: LeadStage;
  version: number;
  sourceType: LeadSource;
  requesterName: string;
  propertyInterest: string | null;
  receivedAt: string;
};

export type LeadDirectoryPage = {
  counts: { new: number; contacted: number; won: number; lost: number };
  items: LeadDirectoryItem[];
  page: number;
  pageSize: number;
  total: number;
  allTotal: number;
  totalPages: number;
};

export type LeadDetail = {
  publicId: string;
  stage: LeadStage;
  version: number;
  sourceType: LeadSource;
  receivedAt: string;
  requester: {
    name: string;
    email: string | null;
    phone: string | null;
    preferredContact: string | null;
    accountLinked: false;
    customerId: null;
    accountType: null;
    profileType: null;
    kycStatus: null;
  };
  message: string | null;
  request: {
    inquiryType?: string;
    sourcePage?: string;
    propertyType?: string;
    propertySubtype?: string;
    bedrooms?: string;
    bathrooms?: string;
    locality?: string;
    state?: string;
    city?: string;
    facilities?: string[];
    budgetMinor?: number;
    paymentIntent?: string;
    timing?: string;
    additionalPreferences?: string;
    preferredDate?: string;
    preferredTime?: string;
    flexibleDates?: boolean;
  };
  property: null | {
    code: string;
    title: string;
    status: "UNLISTED" | "PENDING" | "LISTED" | "REJECTED";
    imageUrl: string | null;
    city: string;
    state: string;
    location: string;
    priceMinor: number;
    minimumDownPaymentMinor: number;
    propertyType: string;
    propertySubtype: string;
    seller: { id: string; name: string };
  };
  referral: null;
  history: {
    id: string;
    fromStage: "NEW" | "CONTACTED";
    toStage: "CONTACTED" | "WON" | "LOST";
    changedAt: string;
    admin: { id: string; name: string };
  }[];
};

export function listAdminLeads(query: { search: string; page: number }, signal?: AbortSignal) {
  const params = new URLSearchParams({ search: query.search, page: String(query.page), pageSize: "40" });
  return adminApi<LeadDirectoryPage>(`/leads?${params}`, signal ? { signal } : undefined);
}

export async function getAdminLead(publicId: string, signal?: AbortSignal) {
  const value = await adminApi<{ lead: LeadDetail }>(`/leads/${encodeURIComponent(publicId)}`, signal ? { signal } : undefined);
  return value.lead;
}

export async function moveAdminLead(publicId: string, stage: Exclude<LeadStage, "NEW">, version: number) {
  const value = await adminApi<{ lead: LeadDetail }>(`/leads/${encodeURIComponent(publicId)}/stage`, {
    method: "POST",
    body: JSON.stringify({ stage, version }),
  });
  return value.lead;
}
