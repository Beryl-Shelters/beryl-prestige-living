import { createClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import { bedroomBuckets, months, type AnalyticsCounts, type BedroomCounts, type PerformanceSeries } from "./analytics-model.js";

export interface AnalyticsRepository {
  counts(customerId: string, search: string): Promise<AnalyticsCounts>;
}
export interface CategoryPerformanceRepository {
  monthly(customerId: string, year: number): Promise<PerformanceSeries>;
}

// These transaction/referral domains do not exist yet. This adapter deliberately
// has no dependency on listings, statuses, prices or listing creation dates.
export class EmptyCategoryPerformanceRepository implements CategoryPerformanceRepository {
  async monthly(): Promise<PerformanceSeries> {
    return { buy: months.map(() => 0), sell: months.map(() => 0), referral: months.map(() => 0) };
  }
}

export class SupabaseAnalyticsRepository implements AnalyticsRepository {
  private readonly db;
  constructor(config: AuthConfig, fetcher: typeof fetch = fetch) {
    this.db = createClient(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetcher(input, { ...init, signal: AbortSignal.timeout(15000) }) },
    });
  }
  async counts(customerId: string, search: string): Promise<AnalyticsCounts> {
    // HEAD/count queries avoid downloading rows, media, or a capped first page.
    // Every query, including every optional filter, retains the session owner.
    const count = async (column?: "listing_status" | "bedrooms" | "property_type", value?: string | number) => {
      let query = this.db.from("customer_listings").select("id", { count: "exact", head: true }).eq("user_id", customerId);
      if (search) {
        const literal = search.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[%_*]/g, character => `\\${character}`);
        query = query.or(`title.ilike."%${literal}%",listing_code.ilike."%${literal}%"`);
      }
      if (column !== undefined && value !== undefined) query = query.eq(column, value);
      const { count: result, error } = await query;
      if (error || result === null || !Number.isSafeInteger(result) || result < 0) throw new Error("Analytics count unavailable");
      return result;
    };
    const [total, listed, pending, rejected, bedrooms, commercial, residential] = await Promise.all([
      count(), count("listing_status", "LISTED"), count("listing_status", "PENDING"), count("listing_status", "REJECTED"),
      Promise.all(bedroomBuckets.map(async bedroom => [bedroom, await count("bedrooms", bedroom)] as const)),
      count("property_type", "Commercial"), count("property_type", "Residential"),
    ]);
    return { total, listed, pending, rejected, bedrooms: Object.fromEntries(bedrooms) as BedroomCounts, commercial, residential };
  }
}
