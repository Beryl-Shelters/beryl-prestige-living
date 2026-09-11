import { months, type CustomerAnalytics } from "./analytics-model.js";
import { EmptyCategoryPerformanceRepository, type AnalyticsRepository, type CategoryPerformanceRepository } from "./analytics-repository.js";

export class AnalyticsService {
  constructor(private readonly listings: AnalyticsRepository,
    private readonly performance: CategoryPerformanceRepository = new EmptyCategoryPerformanceRepository()) {}

  async analytics(customerId: string, search: string, year: number): Promise<CustomerAnalytics> {
    const [counts, series] = await Promise.all([this.listings.counts(customerId, search), this.performance.monthly(customerId, year)]);
    for (const values of Object.values(series)) {
      if (values.length !== 12 || values.some(value => !Number.isFinite(value) || value < 0)) throw new Error("Invalid monthly performance");
    }
    const metric = (count: number) => ({ count, percentage: counts.total === 0 ? 0 : Math.max(0, Math.min(100, Math.round(count / counts.total * 10000) / 100)) });
    return {
      year,
      categoryPerformance: months.map((label, index) => ({ month: index + 1, label, buy: series.buy[index]!, sell: series.sell[index]!, referral: series.referral[index]! })),
      listingsOverview: { total: counts.total, listed: metric(counts.listed), pending: metric(counts.pending), rejected: metric(counts.rejected) },
      bedrooms: counts.bedrooms,
      // The current subtype taxonomy cannot establish these legacy categories.
      propertyTypes: { commercial: counts.commercial, detachedHouses: 0, flats: 0, others: 0, residential: counts.residential },
    };
  }
}
