import { z } from "zod";
import { normalizeNigerianPhone } from "@/utils/phone";

const password = z.string().min(8, "Use at least 8 characters").regex(/[A-Z]/, "Add an uppercase letter").regex(/[a-z]/, "Add a lowercase letter").regex(/\d/, "Add a number").regex(/[^A-Za-z0-9]/, "Add a special character");
export const loginSchema = z.object({ identifier: z.string().trim().min(1, "Enter your email address or phone number").transform(value => value.includes("@") ? value.toLowerCase() : normalizeNigerianPhone(value)), password: z.string().min(1, "Enter your password") });
export const forgotPasswordSchema = z.object({ email: z.string().trim().email("Enter a valid email address").transform(value=>value.toLowerCase()) });
export const resetPasswordSchema = z.object({ newPassword: password, confirmPassword: z.string() }).superRefine((value,ctx)=>{ if(value.newPassword!==value.confirmPassword)ctx.addIssue({code:"custom",path:["confirmPassword"],message:"Passwords do not match"}); });
export type LoginValues = z.output<typeof loginSchema>;
export type ForgotPasswordValues = z.output<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.output<typeof resetPasswordSchema>;
