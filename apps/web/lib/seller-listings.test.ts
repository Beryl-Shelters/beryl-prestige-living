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
    for (const action of ["CONTINUE_PROPERTY_INFORMATION", "CONTINUE_PHOTOS_DOCUMENTS", "CONTINUE_SALES_MANDATE", "CONTINUE_REVIEW", "EDIT_REJECTED_LISTING"] as const) {
      expect(sellerListingRouteForAction(action, id)).toContain(`/seller/listings/${id}?step=`);
    }
    expect(sellerListingActionLabel("EDIT_REJECTED_LISTING")).toBe("Make changes");
  });
});
