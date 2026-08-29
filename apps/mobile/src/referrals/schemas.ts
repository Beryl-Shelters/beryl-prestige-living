import { z } from "zod";
import { normalizeNigerianPhone } from "@/utils/phone";

const phone = z.string().trim().transform(normalizeNigerianPhone).refine((value) => /^\+234\d{10}$/.test(value), "Enter a valid Nigerian phone number");
const name = z.string().trim().min(2, "Enter at least 2 characters").max(100, "Keep this under 100 characters");

export const guestReferrerSchema = z.object({ fullName: name, phone });
export const referredPersonSchema = z.object({
  fullName: name,
  contactMethod: z.enum(["WHATSAPP", "CALL", "EMAIL"]),
  contact: z.string().trim().min(1, "Enter their contact detail")
}).superRefine((value, context) => {
  if (value.contactMethod === "EMAIL" && !z.string().email().safeParse(value.contact).success) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["contact"], message: "Enter a valid email address" });
  }
  if (value.contactMethod !== "EMAIL" && !phone.safeParse(value.contact).success) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["contact"], message: "Enter a valid Nigerian phone number" });
  }
});

export const referralTrackingIdentitySchema = z.object({ fullName: name, phone });
export const referralOtpSchema = z.string().regex(/^\d{6}$/, "Enter the six-digit code");
export const referralPayoutSchema = z.object({
  bankCode: z.string().trim().min(2, "Select a bank"),
  accountNumber: z.string().regex(/^\d{10}$/, "Account number must be exactly 10 digits"),
  accountName: name
});
