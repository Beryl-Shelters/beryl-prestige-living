import { z } from "zod";

export const analyticsQuery = z.object({
  q: z.string().trim().max(100).default(""),
  year: z.string().regex(/^\d{4}$/).transform(Number).pipe(z.number().int().min(2000).max(2100)).optional(),
}).strict();
export const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const bedroomBuckets = [1, 2, 3, 4, 5, 6] as const;
export type BedroomCounts = Record<typeof bedroomBuckets[number], number>;
export type AnalyticsCounts = {
  total: number; listed: number; pending: number; rejected: number;
  bedrooms: BedroomCounts; commercial: number; residential: number;
};
export type PerformanceSeries = Record<"buy" | "sell" | "referral", number[]>;
export type CustomerAnalytics = {
  year: number;
  categoryPerformance: { month: number; label: string; buy: number; sell: number; referral: number }[];
  listingsOverview: { total: number } & Record<"listed" | "pending" | "rejected", { count: number; percentage: number }>;
  bedrooms: BedroomCounts;
  propertyTypes: { commercial: number; detachedHouses: number; flats: number; others: number; residential: number };
};
