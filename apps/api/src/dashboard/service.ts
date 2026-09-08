import type { Customer } from "../auth/gateway.js";
import type { DashboardRepository } from "./repository.js";

export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  async overview(customer: Customer) {
    const [investments, properties, referrals, messages, listings] = await Promise.all([
      this.repository.investments(customer.id), this.repository.propertiesOwned(customer.id),
      this.repository.referralEarnings(customer.id), this.repository.messages(customer.id),
      this.repository.recentListings(customer.id),
    ]);
    return {
      customer: { id: customer.id, first_name: customer.first_name, last_name: customer.last_name,
        account_type: customer.account_type, profile_type: customer.profile_type },
      summary: { total_investments: investments.total, properties_owned: properties,
        referral_earnings: referrals, new_messages: messages.unread },
      revenue: { monthly: investments.monthly, yearly: investments.yearly },
      recent_messages: messages.recent,
      recent_property_listings: listings,
    };
  }
}
