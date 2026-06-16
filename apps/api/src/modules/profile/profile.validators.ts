import { z } from "zod";

export const updateProfileSchema = z.object({
  first_name: z.string().min(2).optional(),
  last_name: z.string().min(2).optional(),
  phone_number: z.string().min(7).optional(),
  bio: z.string().max(1000).optional(),

  street_address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zip_code: z.string().optional(),

  agency_name: z.string().optional(),
  company_email: z.string().email().optional(),
  company_phone_number: z.string().optional(),
  company_bio: z.string().max(1500).optional(),

  company_street_address: z.string().optional(),
  company_city: z.string().optional(),
  company_state: z.string().optional(),
  company_country: z.string().optional(),
  company_zip_code: z.string().optional()
});

export const changePasswordSchema = z.object({
  new_password: z.string().min(8)
});