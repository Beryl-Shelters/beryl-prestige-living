import { describe, expect, it } from "vitest";
import { passwordChecks } from "@/components/auth/password-strength";
import { normalizePhone } from "./phone";
import { buyerOnboardingSchema, loginSchema, resetPasswordSchema, sellerOnboardingSchema, signupSchema } from "./validation";

const signup = { gettingStartedAs: "FIND_PROPERTY", fullName: "Test Customer", email: "customer@example.com", phone: "+2348012345678", isWhatsAppNumber: true, whatsAppNumber: "", password: "Password123!", confirmPassword: "Password123!" } as const;

describe("customer web validation", () => {
  it("accepts the complete signup contract", () => expect(signupSchema.safeParse(signup).success).toBe(true));
  it("accepts both persona selections", () => expect(signupSchema.safeParse({ ...signup, gettingStartedAs: "LIST_PROPERTY" }).success).toBe(true));
  it("requires a separate WhatsApp number when No is selected", () => expect(signupSchema.safeParse({ ...signup, isWhatsAppNumber: false }).success).toBe(false));
  it("rejects confirm-password mismatch", () => expect(signupSchema.safeParse({ ...signup, confirmPassword: "Different123!" }).success).toBe(false));
  it("reports all five password-strength requirements", () => expect(passwordChecks("Password123!").every(([, valid]) => valid)).toBe(true));
  it("normalizes Nigerian local phone numbers", () => expect(normalizePhone("0801 234 5678")).toBe("+2348012345678"));
  it("accepts login identifiers for email", () => expect(loginSchema.safeParse({ identifier: "customer@example.com", password: "Password123!" }).success).toBe(true));
  it("accepts login identifiers for phone", () => expect(loginSchema.safeParse({ identifier: "+2348012345678", password: "Password123!" }).success).toBe(true));
  it("requires a buyer location", () => expect(buyerOnboardingSchema.safeParse({ preferredLocations: [], budgetMin: "", budgetMax: "", currency: "NGN" }).success).toBe(false));
  it("rejects a buyer maximum below minimum", () => expect(buyerOnboardingSchema.safeParse({ preferredLocations: ["Lekki, Lagos"], budgetMin: "200", budgetMax: "100", currency: "NGN" }).success).toBe(false));
  it("accepts an individual seller without company fields", () => expect(sellerOnboardingSchema.safeParse({ profileType: "INDIVIDUAL" }).success).toBe(true));
  it("requires business company fields", () => expect(sellerOnboardingSchema.safeParse({ profileType: "BUSINESS" }).success).toBe(false));
  it("requires matching reset passwords", () => expect(resetPasswordSchema.safeParse({ newPassword: "NewPassword123!", confirmPassword: "OtherPassword123!" }).success).toBe(false));
});
