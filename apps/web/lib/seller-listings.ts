import type { Route } from "next";
import type { SellerListingNextAction, SellerListingStatus, SellerSubmissionResult } from "./contracts";

export const sellerListingTabs: { label: string; status: SellerListingStatus; countKey: "all" | "live" | "inReview" | "rejected" | "draft" }[] = [
  { label: "All", status: "ALL", countKey: "all" },
  { label: "Live", status: "LIVE", countKey: "live" },
  { label: "In Review", status: "IN_REVIEW", countKey: "inReview" },
  { label: "Rejected", status: "REJECTED", countKey: "rejected" },
  { label: "Draft", status: "DRAFT", countKey: "draft" }
];

export const sellerListingRouteForAction = (action: SellerListingNextAction, propertyId: string): Route => {
  switch (action) {
    case "VIEW_LIVE_LISTING": return `/marketplace/${propertyId}` as Route;
    case "VIEW_REVIEW_STATUS":
    case "VIEW_REJECTION": return `/seller/listings/${propertyId}` as Route;
    case "CONTINUE_PROPERTY_INFORMATION": return `/seller/listings/${propertyId}/edit?step=property-information` as Route;
    case "CONTINUE_PHOTOS_DOCUMENTS": return `/seller/listings/${propertyId}/edit?step=photos-documents` as Route;
    case "CONTINUE_SALES_MANDATE": return `/seller/listings/${propertyId}/edit?step=SALES_MANDATE` as Route;
    case "CONTINUE_REVIEW": return `/seller/listings/${propertyId}/edit?step=REVIEW` as Route;
    case "EDIT_REJECTED_LISTING": return `/seller/listings/${propertyId}/edit?step=REVIEW` as Route;
  }
};

export const sellerSubmissionRouteForAction = (action: SellerSubmissionResult["nextAction"]): Route => {
  switch (action) {
    case "OPEN_MY_LISTINGS": return "/seller/listings" as Route;
  }
};

export const sellerListingActionLabel = (action: SellerListingNextAction) => {
  switch (action) {
    case "VIEW_LIVE_LISTING": return "View listing";
    case "VIEW_REVIEW_STATUS": return "View status";
    case "VIEW_REJECTION": return "View feedback";
    case "EDIT_REJECTED_LISTING": return "Make changes";
    case "CONTINUE_PROPERTY_INFORMATION": return "Continue listing";
    default: return "Continue";
  }
};
