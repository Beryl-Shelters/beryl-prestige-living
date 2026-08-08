import { z } from "zod";
import { normalizeNigerianPhone } from "@/utils/phone";
const password = z.string().min(8, "Use at least 8 characters").regex(/[A-Z]/, "Add an uppercase letter").regex(/[a-z]/, "Add a lowercase letter").regex(/\d/, "Add a number").regex(/[^A-Za-z0-9]/, "Add a special character");
const nigeriaPhone = z
  .string()
  .transform(normalizeNigerianPhone)
  .refine((value) => /^\+234\d{10}$/.test(value), "Enter a valid Nigerian phone number");

export const signupSchema = z.object({ gettingStartedAs: z.enum(["FIND_PROPERTY", "LIST_PROPERTY"]), fullName: z.string().trim().min(2, "Enter your full name"), email: z.string().trim().email("Enter a valid email"), phone: nigeriaPhone, isWhatsAppNumber: z.boolean(), whatsAppNumber: z.string().optional(), password, confirmPassword: z.string() }).superRefine((value, ctx) => { if (!value.isWhatsAppNumber && !value.whatsAppNumber) ctx.addIssue({ code: "custom", path: ["whatsAppNumber"], message: "Enter your WhatsApp number" }); if (value.password !== value.confirmPassword) ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" }); });
export type SignupValues = { gettingStartedAs: "FIND_PROPERTY" | "LIST_PROPERTY"; fullName: string; email: string; phone: string; isWhatsAppNumber: boolean; whatsAppNumber?: string; password: string; confirmPassword: string };
export const passwordRules = (value: string) => [["At least 8 characters", value.length >= 8], ["1 uppercase letter", /[A-Z]/.test(value)], ["1 lowercase letter", /[a-z]/.test(value)], ["1 number", /\d/.test(value)], ["1 special character", /[^A-Za-z0-9]/.test(value)]] as const;
