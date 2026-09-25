import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import { AuthError } from "../auth/errors.js";
import type { ComparedProperty, SavedPropertiesQuery, SavedPropertyPage } from "./model.js";

export interface SavedPropertiesRepository {
  list(owner: string, query: SavedPropertiesQuery): Promise<SavedPropertyPage>;
  save(owner: string, propertyCode: string): Promise<boolean>;
  remove(owner: string, propertyCode: string): Promise<boolean>;
  states(owner: string, propertyCodes: string[]): Promise<string[]>;
  compare(owner: string, propertyCodes: string[]): Promise<ComparedProperty[]>;
}

function check(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "P0002") throw new AuthError(404, "PROPERTY_NOT_AVAILABLE", "This property is not available to save.");
  if (["23514", "23502", "22P02"].includes(error.code ?? "")) throw new AuthError(400, "INVALID_SAVED_PROPERTY", "Check the property details.");
  throw new AuthError(503, "SAVED_PROPERTIES_UNAVAILABLE", "Saved properties are temporarily unavailable. Please try again.");
}

export class SupabaseSavedPropertiesRepository implements SavedPropertiesRepository {
  private readonly db;
  constructor(config: AuthConfig) {
    this.db = createClient(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
    });
  }
  private async rpc<T>(name: string, args: Record<string, unknown>) {
    const { data, error } = await this.db.rpc(name, args); check(error); return data as T;
  }
  list(owner: string, query: SavedPropertiesQuery) {
    return this.rpc<SavedPropertyPage>("list_customer_saved_properties", { p_owner: owner, p_query: query.q, p_page: query.page, p_page_size: query.pageSize });
  }
  save(owner: string, propertyCode: string) {
    return this.rpc<boolean>("save_customer_property", { p_owner: owner, p_property_code: propertyCode });
  }
  remove(owner: string, propertyCode: string) {
    return this.rpc<boolean>("remove_customer_saved_property", { p_owner: owner, p_property_code: propertyCode });
  }
  states(owner: string, propertyCodes: string[]) {
    return this.rpc<string[]>("customer_saved_property_states", { p_owner: owner, p_property_codes: propertyCodes });
  }
  async compare(owner: string, propertyCodes: string[]) {
    const { data, error } = await this.db.from("customer_saved_properties").select(
      "listing:customer_listings!inner(listing_code,title,description,property_type,property_subtype,property_cost_minor,minimum_down_payment_minor,state,city,bedrooms,bathrooms,parking_spaces,facilities,year_built,listed_at,listing_status,images:customer_listing_images(url,sort_order))",
    ).eq("user_id", owner).eq("listing.listing_status", "LISTED").in("listing.listing_code", propertyCodes);
    check(error);
    type Row = { listing: { listing_code: string; title: string; description: string; property_type: string; property_subtype: string;
      property_cost_minor: number; minimum_down_payment_minor: number; state: string; city: string; bedrooms: number; bathrooms: number;
      parking_spaces: number; facilities: string[]; year_built: number | null; listed_at: string | null; listing_status: string;
      images: { url: string; sort_order: number }[] } };
    const byCode = new Map(((data ?? []) as unknown as Row[]).map(({ listing }) => [listing.listing_code, {
      code: listing.listing_code, title: listing.title, description: listing.description, propertyType: listing.property_type,
      propertySubtype: listing.property_subtype, priceMinor: listing.property_cost_minor, state: listing.state, city: listing.city,
      bedrooms: listing.bedrooms, bathrooms: listing.bathrooms, parkingSpaces: listing.parking_spaces, facilities: listing.facilities,
      listedAt: listing.listed_at, images: listing.images.sort((a, b) => a.sort_order - b.sort_order).map(image => image.url),
      propertyStatus: "Available" as const, unitSizeSqft: null, yearBuilt: listing.year_built,
      minimumDownPaymentMinor: listing.minimum_down_payment_minor,
    }]));
    return propertyCodes.flatMap(code => { const property = byCode.get(code); return property ? [property] : []; });
  }
}
