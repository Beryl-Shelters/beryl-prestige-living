import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import type { PublicProperty, PublicPropertyPage, PublicPropertyQuery } from "./model.js";

type PropertyRow = {
  listing_code: string; title: string; description: string; property_type: string; property_subtype: string;
  property_cost_minor: number; state: string; city: string; bedrooms: number; bathrooms: number;
  parking_spaces: number; facilities: string[]; listed_at: string | null;
  images: { url: string; sort_order: number }[];
};

export interface PublicPropertiesRepository { list(query: PublicPropertyQuery): Promise<PublicPropertyPage> }

function searchLiteral(value: string) {
  // PostgREST OR grammar uses quoted values; escape its quotes/backslashes and
  // SQL LIKE wildcards so user text is searched literally, not as a filter.
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[%_*]/g, character => `\\${character}`);
}

export class SupabasePublicPropertiesRepository implements PublicPropertiesRepository {
  private readonly db;
  constructor(config: AuthConfig) {
    this.db = createClient(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
    });
  }
  async list(query: PublicPropertyQuery): Promise<PublicPropertyPage> {
    // Never select raw listing rows, owners, documents or media provider IDs.
    let request = this.db.from("customer_listings").select(
      "listing_code,title,description,property_type,property_subtype,property_cost_minor,state,city,bedrooms,bathrooms,parking_spaces,facilities,listed_at,images:customer_listing_images(url,sort_order)",
      { count: "exact" },
    ).eq("listing_status", "LISTED");
    if (query.q) {
      const literal = searchLiteral(query.q);
      request = request.or(["title", "listing_code", "state", "city"].map(field => `${field}.ilike."%${literal}%"`).join(","));
    }
    if (query.propertyType) request = request.eq("property_type", query.propertyType);
    if (query.propertySubtype) request = request.eq("property_subtype", query.propertySubtype);
    if (query.state) request = request.eq("state", query.state);
    if (query.city) request = request.eq("city", query.city);
    if (query.minPrice !== undefined) request = request.gte("property_cost_minor", query.minPrice);
    if (query.maxPrice !== undefined) request = request.lte("property_cost_minor", query.maxPrice);
    if (query.bedrooms !== undefined) request = request.eq("bedrooms", query.bedrooms);
    if (query.bathrooms !== undefined) request = request.eq("bathrooms", query.bathrooms);
    if (query.bedroomsMin !== undefined) request = request.gte("bedrooms", query.bedroomsMin);
    if (query.bathroomsMin !== undefined) request = request.gte("bathrooms", query.bathroomsMin);
    if (query.facility) request = request.contains("facilities", [query.facility]);
    const offset = (query.page - 1) * query.pageSize;
    if (query.sort === "price_asc" || query.sort === "price_desc")
      request = request.order("property_cost_minor", { ascending: query.sort === "price_asc" });
    const oldest = query.sort === "oldest";
    const { data, count, error } = await request.order("listed_at", { ascending: oldest, nullsFirst: false })
      .order("created_at", { ascending: oldest }).order("id", { ascending: oldest }).range(offset, offset + query.pageSize - 1);
    if (error) throw new Error("Public properties unavailable");
    const items: PublicProperty[] = ((data ?? []) as PropertyRow[]).map(row => ({
      code: row.listing_code, title: row.title, description: row.description,
      propertyType: row.property_type, propertySubtype: row.property_subtype,
      priceMinor: row.property_cost_minor, state: row.state, city: row.city,
      bedrooms: row.bedrooms, bathrooms: row.bathrooms, parkingSpaces: row.parking_spaces,
      facilities: row.facilities, listedAt: row.listed_at,
      images: row.images.sort((a, b) => a.sort_order - b.sort_order).map(image => image.url),
    }));
    const total = count ?? 0;
    return { items, page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) };
  }
}
