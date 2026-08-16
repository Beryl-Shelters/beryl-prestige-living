import { env } from "../../config/env";
import { customerServerAnalytics } from "../../analytics/customer-server-analytics";
import { mailService } from "../../services/mail.service";
import { CustomerRegistrationService } from "./customer-registration.service";
import { SupabaseCustomerRegistrationStore } from "./supabase-customer-registration.store";

export const customerRegistrationService = new CustomerRegistrationService(
  new SupabaseCustomerRegistrationStore(),
  mailService,
  {
    otpSecret: env.otpSecret,
    otpExpiryMinutes: env.otpExpiryMinutes,
    otpResendCooldownSeconds: env.otpResendCooldownSeconds,
    otpMaxAttempts: env.otpMaxAttempts
  },
  customerServerAnalytics
);
