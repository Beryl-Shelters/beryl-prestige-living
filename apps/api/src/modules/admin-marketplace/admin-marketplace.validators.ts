import { z } from "zod";

export const adminMarketplaceQueueSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(["ALL", "IN_REVIEW", "LIVE", "REJECTED"]).default("IN_REVIEW")
});

export const approveMarketplacePropertySchema = z.object({}).strict();
export const rejectMarketplacePropertySchema = z.object({ reason: z.string().trim().min(3).max(1000) }).strict();
