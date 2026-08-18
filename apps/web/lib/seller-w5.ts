import type { SellerSalesMandateInput } from "./contracts";

export const mandatePayload = (input: SellerSalesMandateInput): SellerSalesMandateInput => ({
  mandateType: input.mandateType,
  sellerFullName: input.sellerFullName.trim(),
  ownershipConfirmed: input.ownershipConfirmed,
  mandateAccepted: input.mandateAccepted
});

export const incompleteSectionCopy: Record<string, string> = {
  PROPERTY_INFORMATION: "Complete the required property information.",
  PHOTOS: "Add valid property photos and choose one cover image.",
  SALES_MANDATE: "Complete and accept the Sales Mandate."
};
