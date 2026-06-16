import { z } from "zod";

export const trackReferralSchema = z.object({
  referral_code: z.string().min(3),
  property_id: z.string().uuid().optional(),
  referral_type: z.enum(["buyer", "seller"]),
  referred_name: z.string().optional(),
  referred_email: z.string().email().optional(),
  referred_phone: z.string().optional(),
  notes: z.string().optional()
});

export const updateReferralStatusSchema = z.object({
  status: z.enum(["pending", "qualified", "converted", "rejected"]),
  earned_commission: z.number().nonnegative().optional()
});