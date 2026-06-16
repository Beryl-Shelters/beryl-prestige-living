import { z } from "zod";

export const createInquirySchema = z.object({
  property_id: z.string().uuid().optional(),
  inquiry_type: z.string().min(2),
  full_name: z.string().min(2),
  email: z.string().email(),
  phone_number: z.string().min(7),
  message: z.string().min(5)
});

export const updateInquiryStatusSchema = z.object({
  status: z.enum(["pending", "contacted", "scheduled", "closed"]),
  assigned_to: z.string().uuid().optional()
});