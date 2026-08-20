import type { SellerDraft } from "@/lib/contracts";
import { sellerPropertyTypeValues } from "@/lib/marketplace-property-options";

export type SellerDraftPayload = Partial<Omit<SellerDraft, "id" | "images" | "documents">>;

const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const numberOrNull = (value: unknown) => {
  if (value === null) return null;
  if (value === "" || value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};
const integerOrNull = (value: unknown) => {
  const normalized = numberOrNull(value);
  return normalized === null || (normalized !== undefined && Number.isInteger(normalized)) ? normalized : undefined;
};
const oneOf = <T extends string>(value: unknown, options: readonly T[]) =>
  typeof value === "string" && options.includes(value as T) ? value as T : undefined;

export function toSellerDraftPayload(draft: Partial<SellerDraft>): SellerDraftPayload {
  const category = oneOf(draft.propertyCategory, ["RESIDENTIAL", "COMMERCIAL"] as const);
  const propertyType = oneOf(draft.propertyType, sellerPropertyTypeValues);
  const depositType = oneOf(draft.initialDepositType, ["AMOUNT", "PERCENTAGE"] as const);
  const depositValue = numberOrNull(draft.initialDepositValue);
  const amenities = new Map<string, string>();
  for (const item of draft.amenities ?? []) {
    const value = item.trim();
    if (value && !amenities.has(value.toLowerCase())) amenities.set(value.toLowerCase(), value);
  }
  const payload: SellerDraftPayload = {
    ...(text(draft.title) ? { title: text(draft.title) } : {}),
    ...(text(draft.description) ? { description: text(draft.description) } : {}),
    ...(category ? { propertyCategory: category } : {}),
    ...(propertyType ? { propertyType } : {}),
    ...(oneOf(draft.ownershipType, ["PERSONAL", "THIRD_PARTY"] as const) ? { ownershipType: draft.ownershipType } : {}),
    ...(text(draft.publicLocation) ? { publicLocation: text(draft.publicLocation) } : {}),
    ...(text(draft.fullAddress) ? { fullAddress: text(draft.fullAddress) } : {}),
    ...(numberOrNull(draft.askingPrice) !== undefined ? { askingPrice: numberOrNull(draft.askingPrice) as number } : {}),
    negotiable: Boolean(draft.negotiable),
    ...(depositType ? { initialDepositType: depositType } : draft.initialDepositType === null ? { initialDepositType: null, initialDepositValue: null } : {}),
    ...(depositType && depositValue !== undefined && (depositType !== "PERCENTAGE" || depositValue === null || depositValue <= 100) ? { initialDepositValue: depositValue } : {}),
    ...(oneOf(draft.condition, ["OFF_PLAN", "UNDER_CONSTRUCTION", "NEWLY_BUILT", "FAIRLY_USED"] as const) ? { condition: draft.condition } : {}),
    ...(oneOf(draft.furnishing, ["FULLY_FURNISHED", "SEMI_FURNISHED", "UNFURNISHED"] as const) ? { furnishing: draft.furnishing } : draft.furnishing === null ? { furnishing: null } : {}),
    amenities: Array.from(amenities.values()),
    ...(oneOf(draft.currentStep, ["PROPERTY_INFORMATION", "PHOTOS_DOCUMENTS", "SALES_MANDATE", "REVIEW"] as const) ? { currentStep: draft.currentStep } : {})
  };

  if (category === "COMMERCIAL") {
    payload.bedrooms = null;
    payload.bathrooms = null;
    payload.toilets = null;
    payload.parkingSpaces = null;
    const floors = integerOrNull(draft.numberOfFloors);
    const parking = integerOrNull(draft.parkingCapacity);
    if (floors !== undefined) payload.numberOfFloors = floors;
    if (parking !== undefined) payload.parkingCapacity = parking;
  } else {
    payload.numberOfFloors = null;
    payload.parkingCapacity = null;
    for (const key of ["bedrooms", "bathrooms", "toilets", "parkingSpaces"] as const) {
      const value = integerOrNull(draft[key]);
      if (value !== undefined) payload[key] = value;
    }
  }

  return payload;
}
