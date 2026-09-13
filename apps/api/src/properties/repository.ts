import type { PurchasedProperty } from "./model.js";

export interface PurchasedPropertiesRepository {
  list(customerId: string, search: string, page: number, pageSize: number): Promise<{ items: PurchasedProperty[]; total: number }>;
}

// Purchase recording belongs to a future Admin transaction domain. Until that
// source exists, a verified customer has a legitimate empty purchase history.
export class EmptyPurchasedPropertiesRepository implements PurchasedPropertiesRepository {
  async list(customerId: string, search: string, page: number, pageSize: number) {
    void customerId; void search; void page; void pageSize;
    return { items: [], total: 0 };
  }
}
