import { z } from "zod";

export const adminMarketplaceQueueSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(["ALL", "IN_REVIEW", "LIVE", "REJECTED"]).default("IN_REVIEW"),
  q: z.string().trim().max(120).optional().transform((value) => value || undefined),
  category: z.enum(["RESIDENTIAL", "COMMERCIAL"]).optional(),
  mandate: z.enum(["EXCLUSIVE", "OPEN"]).optional(),
  sort: z.enum(["OPERATIONAL", "MOST_RECENT", "OLDEST", "PRICE_HIGH", "PRICE_LOW"]).default("OPERATIONAL")
}).strict();

export const approveMarketplacePropertySchema = z.object({}).strict();
export const rejectMarketplacePropertySchema = z.object({ reason: z.string().trim().min(3).max(1000) }).strict();
