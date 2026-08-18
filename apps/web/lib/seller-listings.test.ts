// @vitest-environment node
import { describe, expect, it } from "vitest";
import { sellerListingActionLabel, sellerListingRouteForAction, sellerListingTabs } from "./seller-listings";

describe("Seller Marketplace listing routes", () => {
  it("keeps the backend status filters and count tabs explicit", () => {
    expect(sellerListingTabs.map((tab) => tab.status)).toEqual(["ALL", "LIVE", "IN_REVIEW", "REJECTED", "DRAFT"]);
    expect(sellerListingTabs.map((tab) => tab.countKey)).toEqual(["all", "live", "inReview", "rejected", "draft"]);
  });

  it("centralizes every Seller lifecycle next action", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(sellerListingRouteForAction("VIEW_LIVE_LISTING", id)).toBe(`/marketplace/${id}`);
    expect(sellerListingRouteForAction("VIEW_REVIEW_STATUS", id)).toBe(`/seller/listings/${id}`);
    expect(sellerListingRouteForAction("VIEW_REJECTION", id)).toBe(`/seller/listings/${id}`);
    expect(sellerListingRouteForAction("CONTINUE_PROPERTY_INFORMATION", id)).toBe(`/seller/listings/${id}/edit?step=property-information`);
    expect(sellerListingRouteForAction("CONTINUE_PHOTOS_DOCUMENTS", id)).toBe(`/seller/listings/${id}/edit?step=photos-documents`);
    expect(sellerListingRouteForAction("CONTINUE_SALES_MANDATE", id)).toBe(`/seller/listings/${id}/edit?step=SALES_MANDATE`);
    expect(sellerListingRouteForAction("CONTINUE_REVIEW", id)).toBe(`/seller/listings/${id}/edit?step=REVIEW`);
    expect(sellerListingRouteForAction("EDIT_REJECTED_LISTING", id)).toBe(`/seller/listings/${id}?step=corrections`);
    expect(sellerListingActionLabel("EDIT_REJECTED_LISTING")).toBe("Make changes");
  });
});
