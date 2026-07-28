import { describe, expect, it } from "vitest";
import {
  buyerOnboardingSchema,
  customerLoginSchema,
  customerRegisterSchema,
  sellerOnboardingSchema
} from "./customer.validators";

const validRegistration = {
  fullName: "Ada Okafor",
  email: " ADA@EXAMPLE.COM ",
  phone: "0801 234 5678",
  isWhatsAppNumber: true,
  gettingStartedAs: "FIND_PROPERTY" as const,
  password: "passw0rd",
  confirmPassword: "passw0rd"
};

describe("customer registration validation", () => {
  it("normalizes customer identifiers and removes confirmPassword", () => {
    const result = customerRegisterSchema.parse(validRegistration);

    expect(result.email).toBe("ada@example.com");
    expect(result.phone).toBe("+2348012345678");
    expect(result.whatsAppNumber).toBe(result.phone);
    expect(result).not.toHaveProperty("confirmPassword");
  });

  it("requires a distinct WhatsApp number when requested", () => {
    const result = customerRegisterSchema.safeParse({
      ...validRegistration,
      isWhatsAppNumber: false
    });

    expect(result.success).toBe(false);
  });

  it("enforces the password policy", () => {
    const result = customerRegisterSchema.safeParse({
      ...validRegistration,
      password: "password",
      confirmPassword: "password"
    });

    expect(result.success).toBe(false);
  });

  it("normalizes either form of login identifier", () => {
    expect(
      customerLoginSchema.parse({ identifier: " ADA@EXAMPLE.COM ", password: "x" })
        .identifier
    ).toBe("ada@example.com");
    expect(
      customerLoginSchema.parse({ identifier: "0801 234 5678", password: "x" })
        .identifier
    ).toBe("+2348012345678");
  });
});

describe("persona onboarding validation", () => {
  it("rejects an inverted buyer budget", () => {
    expect(
      buyerOnboardingSchema.safeParse({
        preferredLocations: ["Lagos"],
        budgetMin: 10,
        budgetMax: 5
      }).success
    ).toBe(false);
  });

  it("requires company details only for a business seller", () => {
    expect(sellerOnboardingSchema.safeParse({ profileType: "BUSINESS" }).success).toBe(
      false
    );
    expect(
      sellerOnboardingSchema.safeParse({ profileType: "INDIVIDUAL" }).success
    ).toBe(true);
  });
});
