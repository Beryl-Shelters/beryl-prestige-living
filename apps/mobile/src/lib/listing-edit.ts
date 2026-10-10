import { MobileApiError } from "./api-error";
import type { CustomerListing, ListingOptions, ListingStatus } from "./listings-api";

export type ListingFormInitialState = {
  title: string;
  registeredTitle: string;
  description: string;
  occupancyType: string;
  ownershipType: string;
  propertyType: string;
  propertySubtype: string;
  hasLien: boolean;
  location: string;
  selectedState: string;
  city: string;
  bedrooms: string;
  bathrooms: string;
  parkingSpaces: string;
  units: string;
  landArea: string;
  yearBuilt: string;
  facilities: string[];
  propertyCost: string;
  downPayment: string;
  additionalInfo: string;
  retainedImages: { id: string; url: string }[];
};

export function canEditListing(status: ListingStatus): boolean {
  return status === "UNLISTED" || status === "REJECTED";
}

export async function loadEditableListing(
  id: string,
  fetchListing: (listingId: string) => Promise<CustomerListing>
): Promise<CustomerListing> {
  const listing = await fetchListing(id);
  if (!canEditListing(listing.listing_status)) {
    throw new MobileApiError(
      "conflict",
      "This property can no longer be edited in its current status.",
      409,
      "LISTING_LOCKED"
    );
  }
  return listing;
}

function optionalNumber(value: number | null): string {
  return value === null ? "" : String(value);
}

export function createListingFormInitialState(
  listing: CustomerListing | null,
  options: ListingOptions
): ListingFormInitialState {
  return {
    title: listing?.title ?? "",
    registeredTitle: listing?.registered_title_document ?? "",
    description: listing?.description ?? "",
    occupancyType: listing?.occupancy_type ?? options.occupancy_type[0] ?? "Residential",
    ownershipType: listing?.ownership_type ?? options.ownership_type[0] ?? "Personal",
    propertyType: listing?.property_type ?? options.property_type[0] ?? "Residential",
    propertySubtype: listing?.property_subtype ?? options.property_subtype[0] ?? "Bungalow",
    hasLien: listing?.has_lien ?? false,
    location: listing?.location ?? "",
    selectedState: listing?.state ?? "Lagos",
    city: listing?.city ?? "",
    bedrooms: String(listing?.bedrooms ?? 3),
    bathrooms: String(listing?.bathrooms ?? 3),
    parkingSpaces: String(listing?.parking_spaces ?? 2),
    units: listing ? optionalNumber(listing.units) : "",
    landArea: listing ? optionalNumber(listing.land_area) : "",
    yearBuilt: listing ? optionalNumber(listing.year_built) : "",
    facilities: [...(listing?.facilities ?? [])],
    propertyCost: listing ? (listing.property_cost_minor / 100).toLocaleString() : "",
    downPayment: listing
      ? (listing.minimum_down_payment_minor / 100).toLocaleString()
      : "0",
    additionalInfo: listing?.additional_information ?? "",
    retainedImages: (listing?.images ?? []).map((image) => ({
      id: image.id,
      url: image.url,
    })),
  };
}
