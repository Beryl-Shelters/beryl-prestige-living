import { CustomerOnboardingService } from "./customer-onboarding.service";
import { customerServerAnalytics } from "../../analytics/customer-server-analytics";
import { SupabaseCustomerOnboardingStore } from "./supabase-customer-onboarding.store";

export const customerOnboardingService = new CustomerOnboardingService(
  new SupabaseCustomerOnboardingStore(),
  customerServerAnalytics
);
