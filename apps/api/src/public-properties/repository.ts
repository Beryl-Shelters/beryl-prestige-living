import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import type { PublicProperty, PublicPropertyDetail, PublicPropertyPage, PublicPropertyQuery } from "./model.js";

type PropertyRow = {
  listing_code: string; title: string; description: string; property_type: string; property_subtype: string;
  property_cost_minor: number; state: string; city: string; bedrooms: number; bathrooms: number;
  parking_spaces: number; facilities: string[]; listed_at: string | null;
  images: { url: string; sort_order: number }[];
};
type PropertyDetailRow = PropertyRow & {
  occupancy_type: string; ownership_type: string; has_lien: boolean;
  minimum_down_payment_minor: number; location: string; land_area: number | string | null; year_built: number | null;
};

export interface PublicPropertiesRepository {
  list(query: PublicPropertyQuery): Promise<PublicPropertyPage>;
  detail(code: string): Promise<{ property: PublicPropertyDetail; similar: PublicProperty[] } | null>;
}

const publicSelection = "listing_code,title,description,property_type,property_subtype,property_cost_minor,state,city,bedrooms,bathrooms,parking_spaces,facilities,listed_at,images:customer_listing_images(url,sort_order)";
const detailSelection = `${publicSelection},occupancy_type,ownership_type,has_lien,minimum_down_payment_minor,location,land_area,year_built`;

function present(row: PropertyRow): PublicProperty {
  return { code: row.listing_code, title: row.title, description: row.description,
    propertyType: row.property_type, propertySubtype: row.property_subtype, priceMinor: row.property_cost_minor,
    state: row.state, city: row.city, bedrooms: row.bedrooms, bathrooms: row.bathrooms,
    parkingSpaces: row.parking_spaces, facilities: row.facilities, listedAt: row.listed_at,
    images: row.images.sort((a, b) => a.sort_order - b.sort_order).map(image => image.url) };
}

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
    let request = this.db.from("customer_listings").select(publicSelection, { count: "exact" }).eq("listing_status", "LISTED");
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
    const items = ((data ?? []) as PropertyRow[]).map(present);
    const total = count ?? 0;
    return { items, page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) };
  }
  async detail(code: string) {
    const { data, error } = await this.db.from("customer_listings").select(detailSelection)
      .eq("listing_code", code).eq("listing_status", "LISTED").maybeSingle();
    if (error) throw new Error("Public property unavailable");
    if (!data) return null;
    const row = data as unknown as PropertyDetailRow;
    const property: PublicPropertyDetail = { ...present(row), occupancyType: row.occupancy_type,
      ownershipType: row.ownership_type, hasLien: row.has_lien,
      minimumDownPaymentMinor: row.minimum_down_payment_minor, location: row.location,
      landArea: row.land_area === null ? null : Number(row.land_area), yearBuilt: row.year_built };
    const similarResult = await this.db.from("customer_listings").select(publicSelection)
      .eq("listing_status", "LISTED").eq("property_type", property.propertyType).neq("listing_code", code)
      .order("listed_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(20);
    if (similarResult.error) throw new Error("Public properties unavailable");
    const similar = ((similarResult.data ?? []) as PropertyRow[]).map(present).sort((left, right) => {
      const score = (candidate: PublicProperty) => Number(candidate.propertySubtype === property.propertySubtype) * 2
        + Number(candidate.city === property.city) + Number(candidate.state === property.state);
      return score(right) - score(left) || (right.listedAt ?? "").localeCompare(left.listedAt ?? "") || left.code.localeCompare(right.code);
    }).slice(0, 4);
    return { property, similar };
  }
}
