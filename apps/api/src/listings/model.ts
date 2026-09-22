import { z } from "zod";
import { AuthError } from "../auth/errors.js";

export const listingOptions = {
  occupancy_type: ["Residential", "Commercial"], ownership_type: ["Personal", "Family"],
  property_type: ["Residential", "Commercial"], property_subtype: ["Bungalow", "Semi-Detached House", "Block of flats", "Terraced Duplexes", "Terraced Bungalows", "Semi-Detached Bungalows", "Detached Bungalows", "Detached Duplexes"],
  facilities: ["Swimming Pool", "Balcony/Terrace", "Children Play Area", "Tennis Court", "Basketball Court", "Gym/Fitness Center", "CCTV", "Air Conditioning", "Laundry", "Garden", "Wi-Fi", "Housekeeping Services", "Car Park", "24Hrs Security"],
  document_type: ["Ownership", "Survey", "Other"],
  state: ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara", "Federal Capital Territory (FCT)"],
} as const;
export const statuses = ["UNLISTED", "PENDING", "LISTED", "REJECTED"] as const;
export type ListingStatus = typeof statuses[number];
export const MAX_IMAGES = 24;
export const PAGE_SIZE = 10;
const text = (max: number) => z.string().trim().min(1).max(max);
const count = z.number().int().min(0).max(100);
const optionalNumber = z.number().finite().nonnegative().max(1e9).nullable();
// Integer kobo remains exact in Postgres and JSON, bounded below MAX_SAFE_INTEGER.
export function minorUnits(value: string) {
  if (!/^(0|[1-9]\d{0,12})(\.\d{1,2})?$/.test(value)) throw new AuthError(400, "INVALID_AMOUNT", "Enter a valid amount with at most two decimal places.");
  const [whole = "0", fraction = ""] = value.split(".");
  return Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")));
}
const money = z.string().regex(/^(0|[1-9]\d{0,12})(\.\d{1,2})?$/).transform(minorUnits);
export const listingInput = z.object({
  title: text(160), description: text(10000), occupancy_type: z.enum(listingOptions.occupancy_type),
  ownership_type: z.enum(listingOptions.ownership_type), property_type: z.enum(listingOptions.property_type),
  property_subtype: z.enum(listingOptions.property_subtype), has_lien: z.boolean(),
  bedrooms: count, bathrooms: count, parking_spaces: count, units: count.nullable(), land_area: optionalNumber,
  year_built: z.number().int().min(1000).max(new Date().getFullYear() + 1).nullable(),
  facilities: z.array(z.enum(listingOptions.facilities)).max(listingOptions.facilities.length).refine(v => new Set(v).size === v.length),
  property_cost: money, minimum_down_payment: money, location: text(300), state: z.enum(listingOptions.state), city: text(100),
  longitude: z.number().finite().min(-180).max(180).nullable(), latitude: z.number().finite().min(-90).max(90).nullable(),
}).strict().refine(v => v.property_cost > 0 && v.minimum_down_payment <= v.property_cost, { message: "Check Property Cost and Minimum Down Payment", path: ["minimum_down_payment"] });
export type ListingContent = Omit<z.output<typeof listingInput>, "property_cost" | "minimum_down_payment"> & { property_cost_minor: number; minimum_down_payment_minor: number };
export function parseContent(value: unknown): ListingContent {
  const { property_cost, minimum_down_payment, ...content } = listingInput.parse(value);
  return { ...content, property_cost_minor: property_cost, minimum_down_payment_minor: minimum_down_payment };
}
export type MediaAsset = { public_id: string; resource_type: "image" | "raw"; delivery_type: "upload" | "authenticated"; url: string; mime_type: string; size_bytes: number };
export type ListingImage = MediaAsset & { id: string; sort_order: number };
export type ListingDocument = MediaAsset & { id: string; batch_id: string; title: string; document_type: string; description: string; sort_order: number };
export type Listing = ListingContent & { id: string; user_id: string; listing_code: string; listing_status: ListingStatus; property_status: "AVAILABLE"; toilet_count: number | null; version: number; created_at: string; updated_at: string; requested_at: string | null; listed_at: string | null; images: ListingImage[]; documents: ListingDocument[] };
export const listingQuery = z.object({ q: z.string().trim().max(100).default(""), status: z.enum(statuses).optional(), page: z.coerce.number().int().min(1).max(100000).default(1), page_size: z.coerce.number().int().min(1).max(50).default(PAGE_SIZE) }).strict();
export type ListingQuery = z.output<typeof listingQuery>;
export const versionInput = z.object({ version: z.number().int().positive() }).strict();
export const documentInput = z.object({ title: text(160), document_type: z.enum(listingOptions.document_type), description: text(2000), version: z.number().int().positive() }).strict();
export function completeness(listing: Listing) {
  const required = [listing.title, listing.description, listing.occupancy_type, listing.ownership_type, listing.property_type, listing.property_subtype,
    typeof listing.has_lien === "boolean", listing.bedrooms >= 0, listing.bathrooms >= 0, listing.parking_spaces >= 0,
    listing.property_cost_minor > 0, listing.minimum_down_payment_minor >= 0 && listing.minimum_down_payment_minor <= listing.property_cost_minor,
    listing.location, listing.state, listing.city, listing.images.length > 0];
  const optional = [listing.units !== null, listing.land_area !== null, listing.year_built !== null, listing.longitude !== null && listing.latitude !== null, listing.facilities.length > 0];
  return Math.min(100, Math.round(required.filter(Boolean).length / required.length * 80 + optional.filter(Boolean).length * 4));
}
export function presentListing(listing: Listing, webOrigin: string) {
  const { user_id: _owner, images, documents, ...fields } = listing;
  void _owner;
  return { ...fields, images: images.map(({ id, url, sort_order }) => ({ id, url, sort_order })),
    documents: documents.map(({ id, batch_id, title, document_type, description, sort_order }) => ({ id, batch_id, title, document_type, description, sort_order })),
    completeness: completeness(listing), leads: 0, views: 0,
    time_on_market: listing.listing_status === "LISTED" && listing.listed_at ? Math.max(0, Math.floor((Date.now() - Date.parse(listing.listed_at)) / 86400000)) : null,
    referral_url: `${webOrigin}/properties/${encodeURIComponent(listing.listing_code)}?ref=share`,
  };
}
