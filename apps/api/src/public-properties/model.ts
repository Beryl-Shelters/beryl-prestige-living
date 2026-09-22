import { z } from "zod";
import { listingOptions } from "../listings/model.js";

const pageNumber = z.string().regex(/^[1-9]\d{0,5}$/).transform(Number).pipe(z.number().int().min(1).max(100000));
const pageSize = z.string().regex(/^[1-9]\d?$/).transform(Number).pipe(z.number().int().min(1).max(50));
// All prices in this public contract are exact integer minor units (kobo).
const priceMinor = z.string().regex(/^(0|[1-9]\d{0,14})$/).transform(Number).pipe(z.number().int().safe().min(0).max(999999999999999));
const count = z.string().regex(/^(0|[1-9]\d{0,2})$/).transform(Number).pipe(z.number().int().min(0).max(100));
const text = (max: number) => z.string().trim().min(1).max(max);

export const publicPropertyQuery = z.strictObject({
  q: z.string().trim().max(100).default(""),
  propertyType: z.enum(listingOptions.property_type).optional(),
  propertySubtype: z.enum(listingOptions.property_subtype).optional(),
  state: z.enum(listingOptions.state).optional(),
  city: text(100).optional(),
  minPrice: priceMinor.optional(),
  maxPrice: priceMinor.optional(),
  bedrooms: count.optional(),
  bathrooms: count.optional(),
  bedroomsMin: z.literal("7").transform(Number).optional(),
  bathroomsMin: z.literal("7").transform(Number).optional(),
  facility: z.enum(listingOptions.facilities).optional(),
  sort: z.enum(["latest", "oldest", "price_asc", "price_desc"]).default("latest"),
  page: pageNumber.default(1),
  pageSize: pageSize.default(10),
}).refine(value => value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice,
  { path: ["maxPrice"], message: "Maximum price must not be below minimum price." })
  .refine(value => value.bedrooms === undefined || value.bedroomsMin === undefined, { path: ["bedroomsMin"] })
  .refine(value => value.bathrooms === undefined || value.bathroomsMin === undefined, { path: ["bathroomsMin"] });

export type PublicPropertyQuery = z.output<typeof publicPropertyQuery>;
export type PublicProperty = {
  code: string; title: string; description: string; propertyType: string; propertySubtype: string;
  priceMinor: number; state: string; city: string; bedrooms: number; bathrooms: number;
  parkingSpaces: number; facilities: string[]; listedAt: string | null; images: string[];
};
export type PublicPropertyPage = { items: PublicProperty[]; page: number; pageSize: number; total: number; totalPages: number };
