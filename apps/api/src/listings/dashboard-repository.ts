import { EmptyDashboardRepository } from "../dashboard/repository.js";
import type { ListingsRepository } from "./repository.js";
export class ListingsDashboardRepository extends EmptyDashboardRepository {
  constructor(private readonly listings:ListingsRepository) { super(); }
  override recentListings(customerId?:string) { if(!customerId) return Promise.resolve([]); return this.listings.recent(customerId); }
}
