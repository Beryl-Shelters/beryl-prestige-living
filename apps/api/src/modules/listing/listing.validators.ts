import { z } from "zod";

export const createListingSchema = z.object({
  property_id: z.string().uuid(),
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  expires_at: z.string().datetime().optional()
});

export const updateListingSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).optional(),
  expires_at: z.string().datetime().optional()
});

export const updateListingStatusSchema = z.object({
  status: z.enum(["pending", "active", "rejected", "expired", "sold", "archived"])
});