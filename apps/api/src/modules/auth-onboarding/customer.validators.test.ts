import { describe, expect, it } from "vitest";
import {
  activatePersonaSchema,
  buyerOnboardingSchema,
  changeCustomerPasswordSchema,
  customerLoginSchema,
  customerRegisterSchema,
  resetCustomerPasswordSchema,
  sellerOnboardingSchema
} from "./customer.validators";

const validRegistration = {
  fullName: "Ada Okafor",
  email: " ADA@EXAMPLE.COM ",
  phone: "0801 234 5678",
  isWhatsAppNumber: true,
  gettingStartedAs: "FIND_PROPERTY" as const,
  password: "Password1!",
  confirmPassword: "Password1!"
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

  it("normalizes a separate WhatsApp number", () => {
    const result = customerRegisterSchema.parse({
      ...validRegistration,
      isWhatsAppNumber: false,
      whatsAppNumber: "0809 876 5432"
    });

    expect(result.whatsAppNumber).toBe("+2348098765432");
  });

  it("enforces the password policy", () => {
    const result = customerRegisterSchema.safeParse({
      ...validRegistration,
      password: "password",
      confirmPassword: "password"
    });

    expect(result.success).toBe(false);
  });

  it("rejects a confirm-password mismatch", () => {
    const result = customerRegisterSchema.safeParse({
      ...validRegistration,
      confirmPassword: "Different1!"
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

  it("applies registration password policy to reset and change requests", () => {
    expect(
      resetCustomerPasswordSchema.safeParse({
        resetToken: "reset-token-that-is-at-least-32-characters",
        newPassword: "weak",
        confirmPassword: "weak"
      }).success
    ).toBe(false);
    expect(
      changeCustomerPasswordSchema.safeParse({
        currentPassword: "Password123!",
        newPassword: "NewPassword123!",
        confirmPassword: "NewPassword123!"
      }).success
    ).toBe(true);
  });

  it("rejects password confirmation mismatch and same-password change", () => {
    expect(
      resetCustomerPasswordSchema.safeParse({
        resetToken: "reset-token-that-is-at-least-32-characters",
        newPassword: "NewPassword123!",
        confirmPassword: "Different123!"
      }).success
    ).toBe(false);
    expect(
      changeCustomerPasswordSchema.safeParse({
        currentPassword: "Password123!",
        newPassword: "Password123!",
        confirmPassword: "Password123!"
      }).success
    ).toBe(false);
  });
});

describe("persona onboarding validation", () => {
  it("normalizes and case-insensitively deduplicates multiple Buyer locations", () => {
    const result = buyerOnboardingSchema.parse({
      preferredLocations: [" Lekki, Lagos ", "lekki, lagos", " Ikoyi, Lagos "]
    });

    expect(result).toMatchObject({
      preferredLocations: ["Lekki, Lagos", "Ikoyi, Lagos"],
      currency: "NGN"
    });
  });

  it("rejects empty Buyer locations", () => {
    expect(
      buyerOnboardingSchema.safeParse({ preferredLocations: ["   "] }).success
    ).toBe(false);
  });

  it("rejects negative Buyer budgets", () => {
    expect(
      buyerOnboardingSchema.safeParse({
        preferredLocations: ["Lagos"],
        budgetMin: -1
      }).success
    ).toBe(false);
  });

  it("rejects an inverted buyer budget", () => {
    expect(
      buyerOnboardingSchema.safeParse({
        preferredLocations: ["Lagos"],
        budgetMin: 10,
        budgetMax: 5
      }).success
    ).toBe(false);
  });

  it("accepts every supported Buyer currency and defaults to NGN", () => {
    expect(
      buyerOnboardingSchema.parse({ preferredLocations: ["Lagos"] })
    ).toMatchObject({ currency: "NGN" });
    for (const currency of ["USD", "GBP", "EUR"] as const) {
      expect(
        buyerOnboardingSchema.safeParse({
          preferredLocations: ["Lagos"],
          currency
        }).success
      ).toBe(true);
    }
  });

  it("accepts Buyer skip by itself and rejects mixed skip/profile data", () => {
    expect(buyerOnboardingSchema.parse({ skip: true })).toEqual({ skip: true });
    expect(
      buyerOnboardingSchema.safeParse({
        skip: true,
        preferredLocations: ["Lagos"]
      }).success
    ).toBe(false);
  });

  it("requires both company fields for a business seller", () => {
    expect(
      sellerOnboardingSchema.safeParse({
        profileType: "BUSINESS",
        companyAddress: "Lagos"
      }).success
    ).toBe(false);
    expect(
      sellerOnboardingSchema.safeParse({
        profileType: "BUSINESS",
        companyName: "Developer Limited"
      }).success
    ).toBe(false);
    expect(
      sellerOnboardingSchema.safeParse({
        profileType: "BUSINESS",
        companyName: " Developer Limited ",
        companyAddress: " Lekki, Lagos "
      }).success
    ).toBe(true);
  });

  it("clears company fields for an individual seller", () => {
    expect(
      sellerOnboardingSchema.parse({
        profileType: "INDIVIDUAL",
        companyName: "Ignored Limited",
        companyAddress: "Ignored address"
      })
    ).toMatchObject({
      profileType: "INDIVIDUAL",
      companyName: undefined,
      companyAddress: undefined
    });
  });

  it("accepts Seller skip by itself and rejects mixed skip/profile data", () => {
    expect(sellerOnboardingSchema.parse({ skip: true })).toEqual({ skip: true });
    expect(
      sellerOnboardingSchema.safeParse({
        skip: true,
        profileType: "INDIVIDUAL"
      }).success
    ).toBe(false);
  });

  it("accepts only supported personaType values and no user-supplied identity", () => {
    expect(
      activatePersonaSchema.parse({ personaType: "SELLER_DEVELOPER" })
    ).toEqual({ personaType: "SELLER_DEVELOPER" });
    expect(
      activatePersonaSchema.safeParse({ personaType: "ADMIN" }).success
    ).toBe(false);
    expect(
      activatePersonaSchema.safeParse({
        personaType: "BUYER",
        userId: "22222222-2222-4222-8222-222222222222"
      }).success
    ).toBe(false);
  });
});
