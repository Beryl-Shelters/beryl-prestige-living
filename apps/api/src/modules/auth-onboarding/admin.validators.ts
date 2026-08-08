import { z } from "zod";
import { ADMIN_DEPARTMENTS, ADMIN_ROLES } from "./auth-onboarding.types";
import { isE164Phone, normalizeEmail, normalizePhone } from "./normalization";

const adminEmail = z.string().trim().email().transform(normalizeEmail);
const adminPhone = z
  .string()
  .transform(normalizePhone)
  .refine(isE164Phone, "Phone number must be a valid international number");
const adminPassword = z
  .string()
  .min(8)
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/\d/, "Password must contain at least one number");
const strongAdminPassword = z
  .string()
  .min(8, "Password must contain at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/\d/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");
const adminOtp = z.string().regex(/^\d{6}$/, "OTP must contain exactly 6 digits");

export const inviteAdminSchema = z.object({
  fullName: z.string().trim().min(2),
  email: adminEmail,
  phone: adminPhone.optional(),
  department: z.enum(ADMIN_DEPARTMENTS),
  adminRole: z.enum(ADMIN_ROLES)
});

export const beginAdminActivationSchema = z.object({
  invitationToken: z.string().min(32),
  temporaryPassword: z.string().min(1)
});

export const resendAdminActivationOtpSchema = z.object({
  challengeId: z.string().uuid()
});

export const verifyAdminActivationOtpSchema = z.object({
  challengeId: z.string().uuid(),
  otp: adminOtp
});

export const setAdminPasswordSchema = z
  .object({
    setupToken: z.string().min(32),
    newPassword: adminPassword,
    confirmPassword: z.string()
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match"
  });

export const adminLoginSchema = z.object({ email: adminEmail, password: z.string().min(1) });
export const verifyAdminLoginOtpSchema = z.object({ challengeId: z.string().uuid(), otp: adminOtp });
export const resendAdminLoginOtpSchema = z.object({ challengeId: z.string().uuid() });
export const refreshAdminSessionSchema = z.object({ refreshToken: z.string().min(32) });
export const changeAdminPasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: strongAdminPassword, confirmPassword: z.string() }).refine((value) => value.newPassword === value.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
export const completeFirstPasswordChangeSchema = z.object({ changePasswordToken: z.string().min(32), currentPassword: z.string().min(1), newPassword: adminPassword, confirmPassword: z.string() }).refine((value) => value.newPassword === value.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
