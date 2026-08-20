import type { SellerDraft } from "@/lib/contracts";

export type SellerDraftPayload = Partial<Omit<SellerDraft, "id" | "images" | "documents">>;

const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const numberOrNull = (value: unknown) => {
  if (value === null) return null;
  if (value === "" || value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};
const oneOf = <T extends string>(value: unknown, options: readonly T[]) =>
  typeof value === "string" && options.includes(value as T) ? value as T : undefined;

export function toSellerDraftPayload(draft: Partial<SellerDraft>): SellerDraftPayload {
  const category = oneOf(draft.propertyCategory, ["RESIDENTIAL", "COMMERCIAL"] as const);
  const payload: SellerDraftPayload = {
    ...(text(draft.title) ? { title: text(draft.title) } : {}),
    ...(text(draft.description) ? { description: text(draft.description) } : {}),
    ...(category ? { propertyCategory: category } : {}),
    ...(text(draft.propertyType) ? { propertyType: text(draft.propertyType) } : {}),
    ...(oneOf(draft.ownershipType, ["PERSONAL", "THIRD_PARTY"] as const) ? { ownershipType: draft.ownershipType } : {}),
    ...(text(draft.publicLocation) ? { publicLocation: text(draft.publicLocation) } : {}),
    ...(text(draft.fullAddress) ? { fullAddress: text(draft.fullAddress) } : {}),
    ...(numberOrNull(draft.askingPrice) !== undefined ? { askingPrice: numberOrNull(draft.askingPrice) as number } : {}),
    negotiable: Boolean(draft.negotiable),
    ...(oneOf(draft.initialDepositType, ["AMOUNT", "PERCENTAGE"] as const) ? { initialDepositType: draft.initialDepositType } : draft.initialDepositType === null ? { initialDepositType: null } : {}),
    ...(numberOrNull(draft.initialDepositValue) !== undefined ? { initialDepositValue: numberOrNull(draft.initialDepositValue) } : {}),
    ...(oneOf(draft.condition, ["OFF_PLAN", "UNDER_CONSTRUCTION", "NEWLY_BUILT", "FAIRLY_USED"] as const) ? { condition: draft.condition } : {}),
    ...(oneOf(draft.furnishing, ["FULLY_FURNISHED", "SEMI_FURNISHED", "UNFURNISHED"] as const) ? { furnishing: draft.furnishing } : draft.furnishing === null ? { furnishing: null } : {}),
    amenities: Array.from(new Set((draft.amenities ?? []).map((item) => item.trim()).filter(Boolean))),
    ...(oneOf(draft.currentStep, ["PROPERTY_INFORMATION", "PHOTOS_DOCUMENTS", "SALES_MANDATE", "REVIEW"] as const) ? { currentStep: draft.currentStep } : {})
  };

  if (category === "COMMERCIAL") {
    payload.bedrooms = null;
    payload.bathrooms = null;
    payload.toilets = null;
    payload.parkingSpaces = null;
    const floors = numberOrNull(draft.numberOfFloors);
    const parking = numberOrNull(draft.parkingCapacity);
    if (floors !== undefined) payload.numberOfFloors = floors;
    if (parking !== undefined) payload.parkingCapacity = parking;
  } else {
    payload.numberOfFloors = null;
    payload.parkingCapacity = null;
    for (const key of ["bedrooms", "bathrooms", "toilets", "parkingSpaces"] as const) {
      const value = numberOrNull(draft[key]);
      if (value !== undefined) payload[key] = value;
    }
  }

  return payload;
}
