import { z } from "zod";
import { isE164Phone, normalizePhone } from "../auth-onboarding/normalization";

const name = z.string().trim().min(2).max(100);
const phone = z.string().trim().transform(normalizePhone).refine(isE164Phone, "Enter a valid phone number");
const referralCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{5,40}$/);

export const submitReferralSchema = z.object({
  referrer: z.object({ fullName: name, phone }).strict().optional(),
  referred: z.object({
    fullName: name,
    contactMethod: z.enum(["WHATSAPP", "CALL", "EMAIL"]),
    phone: phone.optional(),
    email: z.string().trim().toLowerCase().email().max(254).optional()
  }).strict().superRefine((value, context) => {
    if (value.contactMethod === "EMAIL" && !value.email) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Email is required" });
    }
    if (value.contactMethod !== "EMAIL" && !value.phone) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "Phone is required" });
    }
  }),
  purpose: z.enum(["BUYING", "SELLING"]),
  notes: z.string().trim().max(600).optional(),
  privateReferrerDisclosure: z.boolean().default(false),
  consent: z.literal(true),
  referralCode: referralCode.optional()
}).strict();

export const trackingRequestSchema = z.object({ fullName: name, phone }).strict();
export const trackingVerifySchema = z.object({ phone, otp: z.string().regex(/^\d{6}$/) }).strict();
export const payoutDetailsSchema = z.object({
  bankCode: z.string().trim().min(2).max(12),
  accountNumber: z.string().regex(/^\d{10}$/),
  accountName: name
}).strict();
export const referralCodeSchema = referralCode;
export const referralPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(10)
}).strict();

// Compatibility validation for the legacy endpoints retained during migration.
export const trackReferralSchema = z.object({
  referral_code: referralCode,
  property_id: z.string().uuid().optional(),
  referral_type: z.enum(["buyer", "seller"]),
  referred_name: name.optional(),
  referred_email: z.string().email().optional(),
  referred_phone: phone.optional(),
  notes: z.string().trim().max(600).optional()
}).strict().superRefine((value, context) => {
  if (!value.referred_email && !value.referred_phone) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["referred_phone"], message: "A referred contact is required" });
  }
});
export const updateReferralStatusSchema = z.object({
  status: z.enum(["pending", "qualified", "converted", "rejected"]),
  earned_commission: z.number().nonnegative().optional()
}).strict();

export type SubmitReferralInput = z.infer<typeof submitReferralSchema>;
export type PayoutDetailsInput = z.infer<typeof payoutDetailsSchema>;
