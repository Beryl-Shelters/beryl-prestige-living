export type RevenuePoint = { label: string; amount: number };
export type RecentMessage = { id: string; subject: string };
export type RecentListing = { id: string; title: string };

// Each future domain adapter must scope its queries to this server-supplied id.
// These are read models, not new domain tables or placeholder records.
export interface DashboardRepository {
  investments(customerId: string): Promise<{ total: number; monthly: RevenuePoint[]; yearly: RevenuePoint[] }>;
  propertiesOwned(customerId: string): Promise<number>;
  referralEarnings(customerId: string): Promise<number>;
  messages(customerId: string): Promise<{ unread: number; recent: RecentMessage[] }>;
  recentListings(customerId: string): Promise<RecentListing[]>;
}

// Phase 1: none of these domain tables exist in the V2 rebuild. Explicit empty
// adapters keep the contract stable. Do not catch future query errors as zeros.
export class EmptyDashboardRepository implements DashboardRepository {
  async investments() {
    return { total: 0, monthly: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((label) => ({ label, amount: 0 })), yearly: [] };
  }
  async propertiesOwned() { return 0; }
  async referralEarnings() { return 0; }
  async messages() { return { unread: 0, recent: [] }; }
  async recentListings() { return []; }
}
