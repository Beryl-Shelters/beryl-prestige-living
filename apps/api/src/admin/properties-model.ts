import { z } from "zod";

export const adminPropertyStatuses = ["ALL", "UNLISTED", "PENDING", "LISTED", "REJECTED"] as const;
export const adminPropertySorts = ["NEWEST", "OLDEST", "TITLE_ASC", "TITLE_DESC"] as const;
export type AdminPropertyStatus = Exclude<typeof adminPropertyStatuses[number], "ALL">;

export const adminPropertyQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  status: z.enum(adminPropertyStatuses).default("ALL"),
  sort: z.enum(adminPropertySorts).default("NEWEST"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(6),
}).strict();
export type AdminPropertyQuery = z.infer<typeof adminPropertyQuerySchema>;

export const adminPropertyCodeSchema = z.string().trim().min(1).max(80)
  .regex(/^[A-Za-z0-9-]+$/).transform((value) => value.toUpperCase());
export const adminPropertyDocumentIdSchema = z.string().uuid();
export const adminPropertyVersionSchema = z.object({ version: z.number().int().positive() }).strict();
export const adminPropertyRejectionSchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().trim().min(1).max(2000),
}).strict();

export type AdminPropertyDirectoryItem = {
  id: string; code: string; title: string; propertyType: string; propertySubtype: string;
  city: string; state: string; status: AdminPropertyStatus; createdAt: string; updatedAt: string;
  submittedAt: string | null; listedAt: string | null; sellerId: string; sellerName: string;
  thumbnailUrl: string | null; hasMandate: boolean;
};
export type AdminPropertyDirectoryPage = {
  counts: { all: number; unlisted: number; pending: number; approved: number; rejected: number };
  items: AdminPropertyDirectoryItem[]; page: number; pageSize: number; total: number; totalPages: number;
};
export type AdminPropertyDocument = {
  id: string; title: string; sortOrder: number; mimeType: string; sizeBytes: number;
  documentType?: string; description?: string;
};
export type AdminPropertyReview = {
  id: string; action: "APPROVED" | "REJECTED"; reason: string | null;
  submissionRequestedAt: string | null; reviewedAt: string;
  reviewer: { id: string; name: string };
};
export type AdminPropertyDetail = {
  id: string; code: string; version: number; title: string; description: string;
  occupancyType: string; ownershipType: string; propertyType: string; propertySubtype: string;
  hasLien: boolean; bedrooms: number; bathrooms: number; toilets: number | null;
  parkingSpaces: number; units: number | null; landArea: number | null; yearBuilt: number | null;
  facilities: string[]; priceMinor: number; minimumDownPaymentMinor: number;
  location: string; state: string; city: string; registeredTitleDocument: string | null;
  additionalInformation: string | null; status: AdminPropertyStatus; createdAt: string;
  updatedAt: string; submittedAt: string | null; listedAt: string | null;
  rejectionReason: string | null; rejectedAt: string | null;
  seller: { id: string; name: string; email: string; phone: string | null };
  images: { id: string; url: string; sortOrder: number; mimeType: string; sizeBytes: number }[];
  documents: AdminPropertyDocument[];
  mandate: null | {
    id: string; type: "Exclusive"; commissionPercent: 5; signerName: string;
    mandateDate: string; signedAt: string; submittedAt: string | null;
    hasSignature: boolean; documents: AdminPropertyDocument[];
  };
  reviews: AdminPropertyReview[];
};

