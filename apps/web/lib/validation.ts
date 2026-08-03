import { z } from "zod";
import { isValidPhone } from "./phone";

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/\d/, "Add a number")
  .regex(/[^A-Za-z0-9]/, "Add a special character");

export const signupSchema = z
  .object({
    gettingStartedAs: z.enum(["FIND_PROPERTY", "LIST_PROPERTY"]),
    fullName: z.string().trim().min(2, "Enter your full name"),
    email: z.string().email("Enter a valid email address"),
    phone: z.string().refine(isValidPhone, "Enter a valid phone number"),
    isWhatsAppNumber: z.boolean(),
    whatsAppNumber: z.string().optional(),
    password: passwordSchema,
    confirmPassword: z.string()
  })
  .superRefine((value, context) => {
    if (!value.isWhatsAppNumber && !value.whatsAppNumber) {
      context.addIssue({ code: "custom", path: ["whatsAppNumber"], message: "Enter your WhatsApp number" });
    } else if (!value.isWhatsAppNumber && value.whatsAppNumber && !isValidPhone(value.whatsAppNumber)) {
      context.addIssue({ code: "custom", path: ["whatsAppNumber"], message: "Enter a valid WhatsApp number" });
    }
    if (value.password !== value.confirmPassword) {
      context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
    }
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email address or phone number"),
  password: z.string().min(1, "Enter your password")
});

export const emailSchema = z.object({ email: z.string().email("Enter a valid email address") });
export const otpSchema = z.object({ otp: z.string().regex(/^\d{6}$/, "Enter the six-digit code") });

export const resetPasswordSchema = z
  .object({ newPassword: passwordSchema, confirmPassword: z.string() })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match"
  });

export const buyerOnboardingSchema = z
  .object({
    preferredLocations: z.array(z.string()).min(1, "Pick at least one area to continue"),
    budgetMin: z.string().optional(),
    budgetMax: z.string().optional(),
    currency: z.enum(["NGN", "USD", "GBP", "EUR"])
  })
  .refine(
    (value) => !value.budgetMin || !value.budgetMax || Number(value.budgetMax) >= Number(value.budgetMin),
    { path: ["budgetMax"], message: "Maximum budget must be at least the minimum budget" }
  );

export const sellerOnboardingSchema = z
  .object({
    profileType: z.enum(["INDIVIDUAL", "BUSINESS"]),
    companyName: z.string().optional(),
    companyAddress: z.string().optional()
  })
  .superRefine((value, context) => {
    if (value.profileType !== "BUSINESS") return;
    if (!value.companyName?.trim()) context.addIssue({ code: "custom", path: ["companyName"], message: "Enter your company name" });
    if (!value.companyAddress?.trim()) context.addIssue({ code: "custom", path: ["companyAddress"], message: "Enter your company address" });
  });

export type SignupValues = z.infer<typeof signupSchema>;
export type LoginValues = z.infer<typeof loginSchema>;
export type BuyerOnboardingValues = z.infer<typeof buyerOnboardingSchema>;
export type SellerOnboardingValues = z.infer<typeof sellerOnboardingSchema>;
