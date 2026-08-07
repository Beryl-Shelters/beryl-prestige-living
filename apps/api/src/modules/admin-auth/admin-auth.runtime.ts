import { env } from "../../config/env";
import { mailService } from "../../services/mail.service";
import { AdminAuthService } from "./admin-auth.service";
import { SupabaseAdminAuthStore } from "./supabase-admin-auth.store";

export const adminAuthService = new AdminAuthService(new SupabaseAdminAuthStore(), mailService, {
  otpSecret: env.otpSecret,
  invitationTokenSecret: env.adminInvitationTokenSecret,
  invitationExpiresIn: env.adminInvitationExpiresIn,
  activationOtpExpiryMinutes: env.adminActivationOtpExpiryMinutes,
  activationOtpMaxAttempts: env.adminActivationOtpMaxAttempts,
  activationOtpResendCooldownSeconds: env.adminActivationOtpResendCooldownSeconds,
  adminAccessTokenSecret: env.adminAccessTokenSecret,
  adminAccessTokenExpiresIn: env.adminAccessTokenExpiresIn,
  adminRefreshTokenSecret: env.adminRefreshTokenSecret,
  adminRefreshTokenExpiresIn: env.adminRefreshTokenExpiresIn,
  adminLoginOtpExpiryMinutes: env.adminLoginOtpExpiryMinutes,
  adminLoginOtpMaxAttempts: env.adminLoginOtpMaxAttempts,
  adminLoginOtpResendCooldownSeconds: env.adminLoginOtpResendCooldownSeconds,
  adminPasswordChangeProofExpiresIn: env.adminPasswordChangeProofExpiresIn,
  adminActivationUrl: env.adminActivationUrl || (env.adminWebUrl ? `${env.adminWebUrl.replace(/\/$/, "")}/activate` : "http://localhost:3001/activate")
});
