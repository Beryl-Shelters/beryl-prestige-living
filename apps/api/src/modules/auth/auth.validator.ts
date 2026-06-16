import { z } from "zod";

export const registerSchema = z.object({
  first_name: z.string().min(2),
  last_name: z.string().min(2),
  email: z.string().email(),
  phone_number: z.string().min(7).optional(),
  password: z.string().min(8),
  role: z.enum([
    "investor",
    "property_developer",
    "landlord",
    "registered_agent",
    "freelance_agent"
  ]),
  profile_type: z.enum(["personal", "business"]),
  referral_code: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});