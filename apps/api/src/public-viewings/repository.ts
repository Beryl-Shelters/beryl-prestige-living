import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import type { PropertyViewingInput } from "./model.js";

export interface PropertyViewingsRepository { submit(input: PropertyViewingInput): Promise<boolean> }

export class SupabasePropertyViewingsRepository implements PropertyViewingsRepository {
  private readonly db;
  constructor(config: AuthConfig) {
    this.db = createClient(config.supabaseUrl, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) } });
  }
  async submit(input: PropertyViewingInput) {
    const { data, error } = await this.db.rpc("record_public_property_viewing", {
      p_property_code: input.propertyCode, p_first_name: input.firstName, p_last_name: input.lastName,
      p_email: input.email, p_phone: input.phone, p_preferred_date: input.preferredDate,
      p_preferred_time: input.preferredTime, p_flexible_dates: input.flexibleDates,
    });
    if (error) throw new Error("Viewing unavailable");
    return typeof data === "string";
  }
}
