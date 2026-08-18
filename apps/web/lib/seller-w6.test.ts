// @vitest-environment node
import { describe, expect, it } from "vitest";
import { sellerListingRouteForAction } from "./seller-listings";
import { reopenErrorMessage } from "./seller-w6";

describe("Seller Marketplace rejected listing correction", () => {
  const propertyId = "11111111-1111-4111-8111-111111111111";

  it("routes EDIT_REJECTED_LISTING into the canonical existing edit flow", () => {
    expect(sellerListingRouteForAction("EDIT_REJECTED_LISTING", propertyId)).toBe(`/seller/listings/${propertyId}/edit?step=REVIEW`);
  });

  it.each([
    ["LISTING_NOT_REJECTED", "Only rejected listings can be reopened for changes."],
    ["LISTING_ALREADY_REOPENED", "This listing has already been reopened for changes."],
    ["LISTING_REOPEN_FAILED", "We could not reopen this listing. Please try again."]
  ])("maps %s without exposing backend detail", (code, message) => {
    expect(reopenErrorMessage(code)).toBe(message);
    expect(reopenErrorMessage(code)).not.toMatch(/postgres|rpc|database/i);
  });
});
