import { purchasedPropertiesPageSize, type PurchasedPropertiesPage } from "./model.js";
import type { PurchasedPropertiesRepository } from "./repository.js";

export class PurchasedPropertiesService {
  constructor(private readonly repository: PurchasedPropertiesRepository) {}

  async list(customerId: string, search: string, page: number): Promise<PurchasedPropertiesPage> {
    const result = await this.repository.list(customerId, search, page, purchasedPropertiesPageSize);
    return {
      items: result.items,
      page,
      pageSize: purchasedPropertiesPageSize,
      total: result.total,
      totalPages: result.total === 0 ? 0 : Math.ceil(result.total / purchasedPropertiesPageSize),
    };
  }
}
