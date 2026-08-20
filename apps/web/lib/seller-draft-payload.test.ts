import { describe, expect, it } from "vitest";
import { toSellerDraftPayload } from "./seller-draft-payload";

describe("Seller draft request mapper", () => {
  it("omits blank response-only and malformed optional values", () => {
    const payload = toSellerDraftPayload({ id: "property-id", title: "  ", ownershipType: "" as never, askingPrice: Number.NaN, initialDepositValue: Number.NaN, amenities: [" Pool ", "", "Pool"], images: [], documents: [] });
    expect(payload).toEqual(expect.objectContaining({ negotiable: false, amenities: ["Pool"], numberOfFloors: null, parkingCapacity: null }));
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("title");
    expect(payload).not.toHaveProperty("ownershipType");
    expect(payload).not.toHaveProperty("askingPrice");
    expect(JSON.stringify(payload)).not.toContain("NaN");
  });

  it("preserves valid enums and converts safe numeric strings", () => {
    const payload = toSellerDraftPayload({ propertyCategory: "RESIDENTIAL", ownershipType: "PERSONAL", condition: "NEWLY_BUILT", furnishing: "SEMI_FURNISHED", askingPrice: "250000000" as never, bedrooms: "4" as never });
    expect(payload).toMatchObject({ propertyCategory: "RESIDENTIAL", ownershipType: "PERSONAL", condition: "NEWLY_BUILT", furnishing: "SEMI_FURNISHED", askingPrice: 250000000, bedrooms: 4 });
  });

  it("clears stale hidden residential fields when Commercial is selected", () => {
    expect(toSellerDraftPayload({ propertyCategory: "COMMERCIAL", bedrooms: 4, bathrooms: 3, numberOfFloors: 6 })).toMatchObject({ bedrooms: null, bathrooms: null, toilets: null, parkingSpaces: null, numberOfFloors: 6 });
  });

  it("rejects arbitrary property types, clears a removed deposit, and deduplicates amenities case-insensitively", () => {
    const payload = toSellerDraftPayload({ propertyType: "resd" as never, initialDepositType: null, initialDepositValue: 25, amenities: [" Pool ", "pool", "Security", " security "] });
    expect(payload).not.toHaveProperty("propertyType");
    expect(payload).toMatchObject({ initialDepositType: null, initialDepositValue: null, amenities: ["Pool", "Security"] });
  });

  it("omits invalid percentage and negative numeric values", () => {
    const payload = toSellerDraftPayload({ initialDepositType: "PERCENTAGE", initialDepositValue: 101, askingPrice: -1, bedrooms: -2, bathrooms: 2.5 });
    expect(payload).toMatchObject({ initialDepositType: "PERCENTAGE" });
    expect(payload).not.toHaveProperty("initialDepositValue");
    expect(payload).not.toHaveProperty("askingPrice");
    expect(payload).not.toHaveProperty("bedrooms");
    expect(payload).not.toHaveProperty("bathrooms");
  });
});
