import { z } from "zod";
import type {
  SellerDraft,
  SellerListingImage,
  SellerPropertyReview,
} from "@/lib/contracts";
import { sellerPropertyTypeValues } from "@/lib/marketplace-property-options";

export type SellerPropertyInformationField =
  | "title"
  | "propertyType"
  | "description"
  | "propertyCategory"
  | "ownershipType"
  | "publicLocation"
  | "fullAddress"
  | "askingPrice"
  | "initialDepositType"
  | "initialDepositValue"
  | "condition"
  | "furnishing"
  | "bedrooms"
  | "bathrooms"
  | "toilets"
  | "parkingSpaces"
  | "numberOfFloors"
  | "parkingCapacity"
  | "amenities";

export type SellerPropertyInformationErrors = Partial<
  Record<SellerPropertyInformationField, string>
>;

export const sellerPropertyInformationFieldOrder: SellerPropertyInformationField[] = [
  "title",
  "propertyType",
  "description",
  "propertyCategory",
  "ownershipType",
  "publicLocation",
  "fullAddress",
  "askingPrice",
  "initialDepositType",
  "initialDepositValue",
  "bedrooms",
  "bathrooms",
  "toilets",
  "parkingSpaces",
  "numberOfFloors",
  "parkingCapacity",
  "condition",
  "furnishing",
  "amenities",
];

export const sellerPropertyInformationFieldIds: Record<SellerPropertyInformationField, string> = {
  title: "seller-property-title",
  propertyType: "seller-property-type",
  description: "seller-property-description",
  propertyCategory: "seller-property-category",
  ownershipType: "seller-property-ownership",
  publicLocation: "seller-property-location",
  fullAddress: "seller-property-full-address",
  askingPrice: "seller-property-asking-price",
  initialDepositType: "seller-property-deposit-type",
  initialDepositValue: "seller-property-deposit-value",
  condition: "seller-property-condition",
  furnishing: "seller-property-furnishing",
  bedrooms: "seller-property-bedrooms",
  bathrooms: "seller-property-bathrooms",
  toilets: "seller-property-toilets",
  parkingSpaces: "seller-property-parking-spaces",
  numberOfFloors: "seller-property-number-of-floors",
  parkingCapacity: "seller-property-parking-capacity",
  amenities: "seller-property-amenities",
};

const requiredText = (
  errors: SellerPropertyInformationErrors,
  field: SellerPropertyInformationField,
  value: unknown,
  emptyMessage: string,
  max: number,
  maxMessage: string,
) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors[field] = emptyMessage;
  } else if (value.trim().length > max) {
    errors[field] = maxMessage;
  }
};

const optionalCount = (
  errors: SellerPropertyInformationErrors,
  field: SellerPropertyInformationField,
  value: unknown,
  label: string,
) => {
  if (value === undefined || value === null) return;
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    errors[field] = `${label} must be a whole number of zero or more.`;
  }
};

export function validateSellerPropertyInformation(
  draft: Partial<SellerDraft>,
): SellerPropertyInformationErrors {
  const errors: SellerPropertyInformationErrors = {};

  requiredText(errors, "title", draft.title, "Enter a property title.", 180, "Property title must be 180 characters or fewer.");
  requiredText(errors, "description", draft.description, "Enter a property description.", 5000, "Property description must be 5,000 characters or fewer.");
  requiredText(errors, "publicLocation", draft.publicLocation, "Enter the public property location.", 200, "Location must be 200 characters or fewer.");
  requiredText(errors, "fullAddress", draft.fullAddress, "Enter the full property address.", 500, "Full address must be 500 characters or fewer.");

  if (!sellerPropertyTypeValues.includes(draft.propertyType as never)) {
    errors.propertyType = "Select a supported property type.";
  }
  if (!(["RESIDENTIAL", "COMMERCIAL"] as const).includes(draft.propertyCategory as never)) {
    errors.propertyCategory = "Select Residential or Commercial.";
  }
  if (!(["PERSONAL", "THIRD_PARTY"] as const).includes(draft.ownershipType as never)) {
    errors.ownershipType = "Select who owns this property.";
  }
  if (!(["OFF_PLAN", "UNDER_CONSTRUCTION", "NEWLY_BUILT", "FAIRLY_USED"] as const).includes(draft.condition as never)) {
    errors.condition = "Select the property condition.";
  }

  if (typeof draft.askingPrice !== "number" || !Number.isFinite(draft.askingPrice) || draft.askingPrice < 0) {
    errors.askingPrice = draft.askingPrice === undefined
      ? "Enter the asking price."
      : "Enter a valid non-negative asking price.";
  }

  if (draft.initialDepositType !== undefined && draft.initialDepositType !== null && !(["AMOUNT", "PERCENTAGE"] as const).includes(draft.initialDepositType as never)) {
    errors.initialDepositType = "Select a supported initial deposit type.";
  }
  if (draft.initialDepositType === null && draft.initialDepositValue !== undefined && draft.initialDepositValue !== null) {
    errors.initialDepositValue = "Choose a deposit type before entering a value.";
  }
  if (draft.initialDepositValue !== undefined && draft.initialDepositValue !== null) {
    if (typeof draft.initialDepositValue !== "number" || !Number.isFinite(draft.initialDepositValue) || draft.initialDepositValue < 0) {
      errors.initialDepositValue = "Enter a valid non-negative deposit value.";
    } else if (draft.initialDepositType === "PERCENTAGE" && draft.initialDepositValue > 100) {
      errors.initialDepositValue = "Deposit percentage cannot exceed 100%.";
    }
  }

  if (draft.furnishing !== undefined && draft.furnishing !== null && !(["FULLY_FURNISHED", "SEMI_FURNISHED", "UNFURNISHED"] as const).includes(draft.furnishing as never)) {
    errors.furnishing = "Select a supported furnishing option.";
  }

  if (draft.propertyCategory === "COMMERCIAL") {
    optionalCount(errors, "numberOfFloors", draft.numberOfFloors, "Number of floors");
    optionalCount(errors, "parkingCapacity", draft.parkingCapacity, "Parking capacity");
  } else {
    optionalCount(errors, "bedrooms", draft.bedrooms, "Bedrooms");
    optionalCount(errors, "bathrooms", draft.bathrooms, "Bathrooms");
    optionalCount(errors, "toilets", draft.toilets, "Toilets");
    optionalCount(errors, "parkingSpaces", draft.parkingSpaces, "Parking spaces");
  }

  if ((draft.amenities?.length ?? 0) > 50) {
    errors.amenities = "Add no more than 50 amenities.";
  } else if (draft.amenities?.some((amenity) => typeof amenity !== "string" || amenity.trim().length > 80)) {
    errors.amenities = "Each amenity must be 80 characters or fewer.";
  }

  return errors;
}

export type SellerMediaErrors = Partial<
  Record<"images" | "coverImage" | "imageOrder", string>
>;

export function validateSellerMedia(images: SellerListingImage[]): SellerMediaErrors {
  const errors: SellerMediaErrors = {};
  if (images.length < 1) errors.images = "Add at least one property photo before continuing.";
  if (images.length > 10) errors.images = "Use no more than ten property photos.";
  if (images.length > 0 && images.filter((image) => image.isCover).length !== 1) {
    errors.coverImage = "Choose exactly one cover photo before continuing.";
  }
  const orders = images.map((image) => image.order).sort((first, second) => first - second);
  if (images.length > 0 && orders.some((order, index) => !Number.isInteger(order) || order !== index)) {
    errors.imageOrder = "Arrange photos into a complete order before continuing.";
  }
  return errors;
}

export const sellerMandateSchema = z.object({
  mandateType: z.enum(["EXCLUSIVE", "OPEN"], {
    required_error: "Choose a mandate type.",
    invalid_type_error: "Choose a mandate type.",
  }),
  sellerFullName: z.string().trim().min(2, "Enter the Seller's full name.").max(180, "Seller full name must be 180 characters or fewer."),
  ownershipConfirmed: z.boolean().refine(Boolean, "Confirm that you own or are authorized to list this property."),
  mandateAccepted: z.boolean().refine(Boolean, "Accept the Sales Mandate before continuing."),
});

export function validateSellerReview(review: SellerPropertyReview) {
  return {
    missingSections: [...review.validation.missingSections],
    missingFields: [...review.validation.missingFields],
    valid:
      review.validation.missingSections.length === 0 &&
      review.validation.missingFields.length === 0,
  };
}
