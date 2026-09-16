import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";

export type PublicAnalytics = {
  period: "monthly" | "annually";
  // Exact rounded minor units of CURRENT asking prices, grouped by the most
  // recent UTC publication month/year of currently LISTED inventory.
  priceSeries: { label: string; valueMinor: number | null }[];
  propertyPercentage: { totalListedProperties: number; residentialListedProperties: number; residentialPercentage: number };
  searchesPerDay: { date: string; count: number }[];
};

export interface PublicAnalyticsRepository {
  read(period: "monthly" | "annually"): Promise<PublicAnalytics>;
  recordSearch(): Promise<void>;
}

export class SupabasePublicAnalyticsRepository implements PublicAnalyticsRepository {
  private readonly db;
  constructor(config: AuthConfig) {
    this.db = createClient(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
    });
  }
  async read(period: "monthly" | "annually"): Promise<PublicAnalytics> {
    const { data, error } = await this.db.rpc("read_public_property_analytics", { p_period: period });
    if (error || !data) throw new Error("Public analytics unavailable");
    return data as PublicAnalytics;
  }
  async recordSearch(): Promise<void> {
    const { error } = await this.db.from("public_property_search_events").insert({});
    if (error) throw new Error("Search tracking unavailable");
  }
}
