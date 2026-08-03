import { CustomerOnboardingService } from "./customer-onboarding.service";
import { SupabaseCustomerOnboardingStore } from "./supabase-customer-onboarding.store";

export const customerOnboardingService = new CustomerOnboardingService(
  new SupabaseCustomerOnboardingStore()
);
