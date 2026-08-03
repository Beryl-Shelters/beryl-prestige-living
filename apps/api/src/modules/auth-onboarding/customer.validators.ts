import { z } from "zod";
import {
  CURRENCIES,
  GETTING_STARTED_AS,
  PERSONA_TYPES,
  PROFILE_TYPES
} from "./auth-onboarding.types";
import { isE164Phone, normalizeEmail, normalizePhone } from "./normalization";

const email = z.string().trim().email().transform(normalizeEmail);
const phone = z
  .string()
  .transform(normalizePhone)
  .refine(isE164Phone, "Phone number must be a valid international number");
const password = z
  .string()
  .min(8, "Password must contain at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/\d/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");
const otp = z.string().regex(/^\d{6}$/, "OTP must contain exactly 6 digits");
const loginIdentifier = z
  .string()
  .trim()
  .min(1)
  .transform((value) => (value.includes("@") ? normalizeEmail(value) : normalizePhone(value)))
  .refine(
    (value) =>
      value.includes("@")
        ? z.string().email().safeParse(value).success
        : isE164Phone(value),
    "Identifier must be a valid email address or phone number"
  );

export const customerRegisterSchema = z
  .object({
    fullName: z.string().trim().min(2),
    email,
    phone,
    isWhatsAppNumber: z.boolean(),
    whatsAppNumber: phone.nullish(),
    gettingStartedAs: z.enum(GETTING_STARTED_AS),
    password,
    confirmPassword: z.string()
  })
  .superRefine((value, context) => {
    if (!value.isWhatsAppNumber && !value.whatsAppNumber) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["whatsAppNumber"],
        message: "WhatsApp number is required when it differs from phone"
      });
    }

    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match"
      });
    }
  })
  .transform(({ confirmPassword: _confirmPassword, ...value }) => ({
    ...value,
    whatsAppNumber: value.isWhatsAppNumber ? value.phone : value.whatsAppNumber
  }));

export const verifyCustomerEmailSchema = z.object({ email, otp });
export const resendCustomerVerificationSchema = z.object({ email });

export const customerLoginSchema = z.object({
  identifier: loginIdentifier,
  password: z.string().min(1)
}).strict();

export const forgotCustomerPasswordSchema = z.object({ email }).strict();
export const verifyCustomerPasswordResetSchema = z.object({ email, otp }).strict();
export const resetCustomerPasswordSchema = z
  .object({
    resetToken: z.string().min(32),
    newPassword: password,
    confirmPassword: z.string()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
        params: { errorCode: "PASSWORD_VALIDATION_ERROR" }
      });
    }
  });

export const changeCustomerPasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: password,
    confirmPassword: z.string()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.currentPassword === value.newPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "New password must differ from current password",
        params: { errorCode: "NEW_PASSWORD_SAME_AS_CURRENT" }
      });
    }

    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
        params: { errorCode: "PASSWORD_VALIDATION_ERROR" }
      });
    }
  });

export const refreshCustomerSessionSchema = z.object({
  refreshToken: z.string().min(32)
}).strict();

export const logoutCustomerSessionSchema = refreshCustomerSessionSchema;

export const buyerOnboardingSchema = z
  .union([
    z.object({ skip: z.literal(true) }).strict(),
    z
      .object({
        skip: z.literal(false).optional(),
        preferredLocations: z
          .array(z.string().trim().min(1).max(120))
          .min(1)
          .max(10)
          .transform((locations) => {
            const seen = new Set<string>();
            return locations.filter((location) => {
              const normalized = location.toLocaleLowerCase("en");
              if (seen.has(normalized)) return false;
              seen.add(normalized);
              return true;
            });
          }),
        budgetMin: z.number().finite().nonnegative().optional(),
        budgetMax: z.number().finite().nonnegative().optional(),
        currency: z.enum(CURRENCIES).default("NGN")
      })
      .strict()
      .superRefine((value, context) => {
        if (
          value.budgetMin !== undefined &&
          value.budgetMax !== undefined &&
          value.budgetMax < value.budgetMin
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["budgetMax"],
            message:
              "Maximum budget must be greater than or equal to minimum budget",
            params: { errorCode: "INVALID_BUDGET_RANGE" }
          });
        }
      })
  ]);

export const sellerOnboardingSchema = z
  .union([
    z.object({ skip: z.literal(true) }).strict(),
    z
      .object({
        skip: z.literal(false).optional(),
        profileType: z.enum(PROFILE_TYPES),
        companyName: z.string().trim().min(2).max(160).optional(),
        companyAddress: z.string().trim().min(2).max(500).optional()
      })
      .strict()
      .superRefine((value, context) => {
        if (value.profileType !== "BUSINESS") return;

        if (!value.companyName) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["companyName"],
            message: "Company name is required for a business profile"
          });
        }

        if (!value.companyAddress) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["companyAddress"],
            message: "Company address is required for a business profile"
          });
        }
      })
      .transform((value) =>
        value.profileType === "INDIVIDUAL"
          ? { ...value, companyName: undefined, companyAddress: undefined }
          : value
      )
  ]);

export const activatePersonaSchema = z.object({
  personaType: z.enum(PERSONA_TYPES)
}).strict();

export const switchPersonaSchema = activatePersonaSchema;
