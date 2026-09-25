import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import { AuthError } from "../auth/errors.js";
import type { SavedPropertiesQuery, SavedPropertyPage } from "./model.js";

export interface SavedPropertiesRepository {
  list(owner: string, query: SavedPropertiesQuery): Promise<SavedPropertyPage>;
  save(owner: string, propertyCode: string): Promise<boolean>;
  remove(owner: string, propertyCode: string): Promise<boolean>;
  states(owner: string, propertyCodes: string[]): Promise<string[]>;
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
}

