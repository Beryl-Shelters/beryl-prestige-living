import { describe, expect, it } from "vitest";
import type { SellerDraft, SellerPropertyReview } from "@/lib/contracts";
import {
  sellerMandateSchema,
  validateSellerMedia,
  validateSellerPropertyInformation,
  validateSellerReview,
} from "./seller-wizard-validation";

const validPropertyInformation: Partial<SellerDraft> = {
  title: "Four bedroom home",
  description: "A complete property description.",
  propertyCategory: "RESIDENTIAL",
  propertyType: "DUPLEX",
  ownershipType: "PERSONAL",
  publicLocation: "Lekki, Lagos",
  fullAddress: "12 Private Street",
  askingPrice: 250000000,
  condition: "NEWLY_BUILT",
};

describe("Seller wizard validation contract", () => {
  it("rejects every missing required Step 1 field", () => {
    expect(validateSellerPropertyInformation({})).toMatchObject({
      title: expect.any(String),
      description: expect.any(String),
      propertyCategory: expect.any(String),
      propertyType: expect.any(String),
      ownershipType: expect.any(String),
      publicLocation: expect.any(String),
      fullAddress: expect.any(String),
      askingPrice: expect.any(String),
      condition: expect.any(String),
    });
  });

  it("treats whitespace-only required text as empty and accepts trimmed free-text location", () => {
    const invalid = validateSellerPropertyInformation({
      ...validPropertyInformation,
      title: "  ",
      description: "\n ",
      publicLocation: "  ",
      fullAddress: "\t",
    });
    expect(invalid).toMatchObject({
      title: "Enter a property title.",
      description: "Enter a property description.",
      publicLocation: "Enter the public property location.",
      fullAddress: "Enter the full property address.",
    });
    expect(validateSellerPropertyInformation({ ...validPropertyInformation, publicLocation: "  Custom Estate, Lagos  " })).toEqual({});
  });

  it("accepts the API-backed required contract while leaving optional details optional", () => {
    expect(validateSellerPropertyInformation(validPropertyInformation)).toEqual({});
    expect(validateSellerPropertyInformation({ ...validPropertyInformation, askingPrice: 0 })).toEqual({});
  });

  it("rejects unsupported enums and malformed numeric values without inventing maxima", () => {
    const errors = validateSellerPropertyInformation({
      ...validPropertyInformation,
      propertyType: "CASTLE" as SellerDraft["propertyType"],
      propertyCategory: "LAND" as SellerDraft["propertyCategory"],
      ownershipType: "UNKNOWN" as SellerDraft["ownershipType"],
      condition: "OLD" as SellerDraft["condition"],
      askingPrice: Number.NaN,
      bedrooms: -1,
    });
    expect(errors).toMatchObject({ propertyType: expect.any(String), propertyCategory: expect.any(String), ownershipType: expect.any(String), condition: expect.any(String), askingPrice: expect.any(String), bedrooms: expect.any(String) });
  });

  it("validates only structurally supplied optional deposit, furnishing, count, and amenity values", () => {
    expect(validateSellerPropertyInformation({ ...validPropertyInformation, initialDepositType: "PERCENTAGE", initialDepositValue: 101 }).initialDepositValue).toContain("100");
    expect(validateSellerPropertyInformation({ ...validPropertyInformation, initialDepositType: null, initialDepositValue: 5 }).initialDepositValue).toContain("deposit type");
    expect(validateSellerPropertyInformation({ ...validPropertyInformation, furnishing: "PARTLY" as SellerDraft["furnishing"] }).furnishing).toBeTruthy();
    expect(validateSellerPropertyInformation({ ...validPropertyInformation, amenities: ["x".repeat(81)] }).amenities).toBeTruthy();
  });

  it("requires one to ten ordered photos with exactly one cover for Step 2", () => {
    expect(validateSellerMedia([])).toEqual({ images: expect.any(String) });
    expect(validateSellerMedia([{ id: "one", url: "one", order: 0, isCover: false }])).toEqual({ coverImage: expect.any(String) });
    expect(validateSellerMedia([{ id: "one", url: "one", order: 1, isCover: true }])).toEqual({ imageOrder: expect.any(String) });
    expect(validateSellerMedia([{ id: "one", url: "one", order: 0, isCover: true }])).toEqual({});
  });

  it("requires the established Step 3 mandate fields and accepts a complete mandate", () => {
    expect(sellerMandateSchema.safeParse({ sellerFullName: " ", ownershipConfirmed: false, mandateAccepted: false }).success).toBe(false);
    expect(sellerMandateSchema.safeParse({ mandateType: "EXCLUSIVE", sellerFullName: "Test Seller", ownershipConfirmed: true, mandateAccepted: true }).success).toBe(true);
  });

  it("uses the server-provided review validation as the Step 4 authority", () => {
    const review = { validation: { missingSections: ["PHOTOS"], missingFields: ["coverImage"] } } as SellerPropertyReview;
    expect(validateSellerReview(review)).toEqual({ valid: false, missingSections: ["PHOTOS"], missingFields: ["coverImage"] });
    review.validation = { missingSections: [], missingFields: ["title"] };
    expect(validateSellerReview(review).valid).toBe(false);
    review.validation = { missingSections: [], missingFields: [] };
    expect(validateSellerReview(review).valid).toBe(true);
  });
});
