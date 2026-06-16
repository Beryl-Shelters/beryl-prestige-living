import { z } from "zod";

export const createMandateSchema = z.object({
  property_id: z.string().uuid().optional(),
  mandate_type: z.enum(["buyer", "seller"]),
  full_name: z.string().min(2),
  email: z.string().email(),
  phone_number: z.string().min(7),
  address: z.string().min(3),
  nationality: z.string().optional(),
  date_of_birth: z.string().optional(),
  title_document: z.string().optional(),
  signature_data: z.string().optional(),
  terms_accepted: z.boolean()
});

export const reviewMandateSchema = z.object({
  status: z.enum(["pending", "under_review", "approved", "rejected"]),
  rejection_reason: z.string().optional()
});