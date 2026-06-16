import { z } from "zod";

export const updateUserStatusSchema = z.object({
  is_active: z.boolean()
});

export const verifyUserSchema = z.object({
  verification_status: z.enum(["pending", "verified", "rejected"])
});

export const rejectPropertySchema = z.object({
  rejection_reason: z.string().min(3)
});

export const createAdminUserSchema = z.object({
  first_name: z.string().min(2),
  last_name: z.string().min(2),
  email: z.string().email(),
  phone_number: z.string().optional(),
  password: z.string().min(8),
  role: z.enum(["admin", "support_agent"])
});

export const updateUserRoleSchema = z.object({
  role: z.enum([
    "investor",
    "property_developer",
    "landlord",
    "registered_agent",
    "freelance_agent",
    "admin",
    "support_agent"
  ])
});