import { z } from "zod";

export const createPropertySchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  category: z.string(),
  property_type: z.string(),
  property_subtype: z.string().optional(),
  listing_purpose: z.string(),
  price: z.number().nonnegative(),
  minimum_down_payment: z.number().nonnegative().optional(),
  agency_fee: z.number().nonnegative().optional(),
  service_fee: z.number().nonnegative().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  toilets: z.number().int().nonnegative().optional(),
  parking_spaces: z.number().int().nonnegative().optional(),
  number_of_units: z.number().int().nonnegative().optional(),
  land_area: z.number().nonnegative().optional(),
  land_area_unit: z.string().optional(),
  year_built: z.number().int().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  local_government: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  map_url: z.string().optional(),
  has_lien: z.boolean().optional(),
  title_document_type: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  thumbnail_url: z.string().optional()
});

export const updatePropertySchema = createPropertySchema.partial();

export const propertyQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  property_type: z.string().optional(),
  listing_purpose: z.string().optional(),
  status: z.string().optional(),
  min_price: z.string().optional(),
  max_price: z.string().optional(),
  sort: z.string().optional()
});