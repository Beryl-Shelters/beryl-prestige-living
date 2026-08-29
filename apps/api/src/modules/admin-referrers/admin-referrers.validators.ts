import { z } from "zod";

export const adminReferrerIdSchema = z.string().uuid();
export const adminReferralIdSchema = z.string().uuid();

export const adminReferrerListSchema = z.object({
  q: z.string().trim().max(120).optional().transform((value) => value || undefined),
  payment: z.enum(["ALL", "OWED", "FULLY_PAID"]).default("ALL"),
  sort: z.enum(["MOST_RECENT", "OLDEST", "NAME_ASC", "MOST_OWED", "MOST_EARNED"]).default("MOST_RECENT"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10)
}).strict();

export type AdminReferrerListInput = z.infer<typeof adminReferrerListSchema>;
