import { z } from "zod";

export const adminLeadStages = ["NEW", "CONTACTED", "WON", "LOST"] as const;
export type AdminLeadStage = typeof adminLeadStages[number];
export type AdminLeadSource = "REAL_ESTATE_INQUIRY" | "BUY_ASSISTANCE" | "PROPERTY_VIEWING";

export const adminLeadQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(40),
}).strict();
export type AdminLeadQuery = z.infer<typeof adminLeadQuerySchema>;

export const adminLeadIdSchema = z.string().trim().toUpperCase().regex(/^ENQ-[A-HJ-NP-Z2-9]{6}$/);
export const adminLeadTransitionSchema = z.object({
  stage: z.enum(["CONTACTED", "WON", "LOST"]),
  version: z.number().int().positive(),
}).strict();

export type AdminLeadDirectoryItem = {
  publicId: string;
  stage: AdminLeadStage;
  version: number;
  sourceType: AdminLeadSource;
  requesterName: string;
  propertyInterest: string | null;
  receivedAt: string;
};

export type AdminLeadDirectoryPage = {
  counts: { new: number; contacted: number; won: number; lost: number };
  items: AdminLeadDirectoryItem[];
  page: number;
  pageSize: number;
  total: number;
  allTotal: number;
  totalPages: number;
};

export type AdminLeadDetail = {
  publicId: string;
  stage: AdminLeadStage;
  version: number;
  sourceType: AdminLeadSource;
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
