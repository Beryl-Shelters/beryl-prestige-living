import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";
import { AuthError } from "./errors.js";

export const accountTypes = ["INVESTOR", "PROPERTY_DEVELOPER", "LANDLORD", "REGISTERED_AGENT", "FREELANCE_AGENT"] as const;
export const profileTypes = ["PERSONAL", "BUSINESS"] as const;
const password = z.string().min(12, "Use a password with at least 12 characters.").max(128, "Password must be at most 128 characters.");
export const resetSchema = z.object({ password, confirmPassword: z.string() }).strict().refine((data) => data.password === data.confirmPassword, { message: "Passwords do not match.", path: ["confirmPassword"] });
export const registerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  countryCode: z.string().regex(/^\+[1-9]\d{0,2}$/, "Select a valid country code."),
  phoneNumber: z.string().regex(/^\d{5,15}$/, "Phone number must contain digits only."),
  accountType: z.enum(accountTypes), profileType: z.enum(profileTypes),
  password, confirmPassword: z.string(),
}).strict().refine((data) => data.password === data.confirmPassword, { message: "Passwords do not match.", path: ["confirmPassword"] });
export type Registration = z.infer<typeof registerSchema>;
export const identifierSchema = z.object({ identifier: z.string().trim().min(1).max(254) }).strict();
export const loginSchema = identifierSchema.extend({ password: z.string().min(1).max(128) });
export const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the six-digit code.") }).strict();

export function normalizePhone(value: string, countryCode?: string): string {
  // Manual forms collect national digits; login also accepts +E.164 or Nigerian national format.
  const raw = value;
  if (!/^[+\d\s()-]+$/.test(raw)) throw new AuthError(400, "INVALID_PHONE", "Enter a valid phone number.");
  const phone = countryCode ? parsePhoneNumberFromString(raw, { defaultCallingCode: countryCode.slice(1) }) : parsePhoneNumberFromString(raw, "NG");
  if (!phone?.isValid()) throw new AuthError(400, "INVALID_PHONE", "Enter a valid phone number, including its country code.");
  return phone.number;
}

export function normalizeIdentifier(identifier: string): { column: "email" | "phone_number_normalized"; value: string } {
  if (identifier.includes("@")) return { column: "email", value: z.email().parse(identifier.trim().toLowerCase()) };
  return { column: "phone_number_normalized", value: normalizePhone(identifier) };
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local?.slice(0, 1)}***@${domain}`;
}
