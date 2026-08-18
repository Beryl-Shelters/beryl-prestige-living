import type { Route } from "next";
import type { SellerDraft } from "./contracts";
import { sellerListingRouteForAction } from "./seller-listings";

type SaveExistingDraft = (propertyId: string, body: Partial<SellerDraft>) => Promise<unknown>;
type Navigate = (route: Route) => void;

export async function continueSellerDraftToSalesMandate(
  propertyId: string,
  saveExistingDraft: SaveExistingDraft,
  navigate: Navigate
) {
  await saveExistingDraft(propertyId, { currentStep: "SALES_MANDATE" });
  navigate(sellerListingRouteForAction("CONTINUE_SALES_MANDATE", propertyId));
}
