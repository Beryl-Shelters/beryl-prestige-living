import { env } from "../../config/env";
import { customerServerAnalytics } from "../../analytics/customer-server-analytics";
import { mailService } from "../../services/mail.service";
import { CustomerAuthenticationService } from "./customer-authentication.service";
import { SupabaseCustomerAuthenticationStore } from "./supabase-customer-authentication.store";

export const customerAuthenticationService = new CustomerAuthenticationService(
  new SupabaseCustomerAuthenticationStore(),
  mailService,
  {
    otpSecret: env.otpSecret,
    accessTokenSecret: env.customerAccessTokenSecret,
    refreshTokenSecret: env.customerRefreshTokenSecret,
    accessTokenExpiresIn: env.customerAccessTokenExpiresIn,
    refreshTokenExpiresIn: env.customerRefreshTokenExpiresIn,
    otpExpiryMinutes: env.otpExpiryMinutes,
    otpResendCooldownSeconds: env.otpResendCooldownSeconds,
    otpMaxAttempts: env.otpMaxAttempts,
    resetProofExpiresIn: env.customerPasswordResetProofExpiresIn
  },
  customerServerAnalytics
);
