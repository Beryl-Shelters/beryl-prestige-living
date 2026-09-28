import { z } from "zod";

export const adminCustomerAccountTypes = ["ALL", "INVESTOR", "PROPERTY_DEVELOPER", "LANDLORD", "REGISTERED_AGENT", "FREELANCE_AGENT"] as const;
export const adminCustomerProfileTypes = ["ALL", "PERSONAL", "BUSINESS"] as const;
export const adminCustomerSorts = ["NEWEST", "OLDEST", "NAME_ASC", "NAME_DESC"] as const;

export const adminCustomerDirectoryQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  accountType: z.enum(adminCustomerAccountTypes).default("ALL"),
  profileType: z.enum(adminCustomerProfileTypes).default("ALL"),
  sort: z.enum(adminCustomerSorts).default("NEWEST"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(6),
}).strict();

export const adminCustomerIdSchema = z.string().uuid();

export type AdminCustomerAccountType = Exclude<typeof adminCustomerAccountTypes[number], "ALL">;
export type AdminCustomerProfileType = Exclude<typeof adminCustomerProfileTypes[number], "ALL">;
export type AdminCustomerDirectoryQuery = z.infer<typeof adminCustomerDirectoryQuerySchema>;
export type AdminCustomerKycStatus = "NOT_SUBMITTED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export type AdminCustomerSummary = {
  totalUsers: number;
  propertyActivityCustomers: number;
  listingActivityCustomers: number;
  referralActivityCustomers: number;
};

export type AdminCustomerDirectoryItem = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  joinedAt: string;
  accountType: AdminCustomerAccountType | null;
  profileType: AdminCustomerProfileType | null;
  hasPropertyActivity: boolean;
  hasListingActivity: boolean;
  hasReferralActivity: boolean;
  referralCode: string | null;
  kycStatus: AdminCustomerKycStatus;
};

export type AdminCustomerDirectoryPage = {
  summary: AdminCustomerSummary;
  items: AdminCustomerDirectoryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminCustomerDetail = AdminCustomerDirectoryItem & {
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
