import { z } from "zod";

export const adminUserIdSchema = z.string().uuid();
export const adminUserListSchema = z.object({
  q: z.string().trim().max(120).optional().transform((value) => value || undefined),
  role: z.enum(["BUYER", "SELLER", "REFERRER"]).optional(),
  verification: z.enum(["VERIFIED", "UNVERIFIED"]).optional(),
  sort: z.enum(["MOST_RECENT", "OLDEST", "NAME_ASC", "NAME_DESC"]).default("MOST_RECENT"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(6)
}).strict();

export type AdminUserListInput = z.infer<typeof adminUserListSchema>;
