// @vitest-environment node
import { describe, expect, it } from "vitest";
import { sellerListingRouteForAction } from "./seller-listings";
import { incompleteSectionCopy, mandatePayload } from "./seller-w5";

describe("Seller Marketplace W5 contracts", () => {
  it.each(["EXCLUSIVE", "OPEN"] as const)("maps %s without changing its machine value", (mandateType) => {
    expect(mandatePayload({ mandateType, sellerFullName: "  Test Seller  ", ownershipConfirmed: true, mandateAccepted: true })).toEqual({ mandateType, sellerFullName: "Test Seller", ownershipConfirmed: true, mandateAccepted: true });
  });

  it("never includes server-owned acceptance or commission fields", () => {
    const payload = mandatePayload({ mandateType: "OPEN", sellerFullName: "Test Seller", ownershipConfirmed: false, mandateAccepted: false });
    expect(payload).not.toHaveProperty("acceptedAt");
    expect(payload).not.toHaveProperty("agreementVersion");
    expect(payload).not.toHaveProperty("commissionPercentage");
    expect(payload).not.toHaveProperty("commissionAmount");
  });

  it("centralizes all four editable steps on the canonical edit route", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(sellerListingRouteForAction("CONTINUE_PROPERTY_INFORMATION", id)).toContain(`/${id}/edit?step=property-information`);
    expect(sellerListingRouteForAction("CONTINUE_PHOTOS_DOCUMENTS", id)).toContain(`/${id}/edit?step=photos-documents`);
    expect(sellerListingRouteForAction("CONTINUE_SALES_MANDATE", id)).toContain(`/${id}/edit?step=SALES_MANDATE`);
    expect(sellerListingRouteForAction("CONTINUE_REVIEW", id)).toContain(`/${id}/edit?step=REVIEW`);
  });

  it("provides safe correction copy for every backend submission section", () => {
    expect(incompleteSectionCopy).toEqual({
      PROPERTY_INFORMATION: "Complete the required property information.",
      PHOTOS: "Add valid property photos and choose one cover image.",
      SALES_MANDATE: "Complete and accept the Sales Mandate."
    });
  });
});
