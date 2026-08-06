import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),

  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",

  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",

  clientWebUrl:
    process.env.PUBLIC_WEB_URL ||
    process.env.CLIENT_WEB_URL ||
    "http://localhost:3000",
  clientMobileUrl: process.env.CLIENT_MOBILE_URL || "",
  apiBaseUrl: process.env.API_PUBLIC_URL || process.env.API_BASE_URL || "",
  adminWebUrl: process.env.ADMIN_WEB_URL || "",
  adminActivationUrl: process.env.ADMIN_ACTIVATION_URL || "",
  adminInvitationTokenSecret: process.env.ADMIN_INVITATION_TOKEN_SECRET || "",

  initialSuperAdminEmail:
    process.env.INITIAL_SUPER_ADMIN_EMAIL || "berylsshelter@gmail.com",
  initialSuperAdminPassword: process.env.INITIAL_SUPER_ADMIN_PASSWORD || "",
  otpSecret: process.env.OTP_HASH_SECRET || "",
  customerSessionTokenSecret: process.env.CUSTOMER_SESSION_TOKEN_SECRET || "",
  customerAccessTokenSecret:
    process.env.CUSTOMER_ACCESS_TOKEN_SECRET ||
    process.env.CUSTOMER_SESSION_TOKEN_SECRET ||
    "",
  customerRefreshTokenSecret: process.env.CUSTOMER_REFRESH_TOKEN_SECRET || "",
  adminSessionTokenSecret: process.env.ADMIN_SESSION_TOKEN_SECRET || "",
  adminAccessTokenSecret: process.env.ADMIN_ACCESS_TOKEN_SECRET || "",
  adminRefreshTokenSecret: process.env.ADMIN_REFRESH_TOKEN_SECRET || "",
  customerAccessTokenMinutes: Number(process.env.CUSTOMER_ACCESS_TOKEN_MINUTES || 15),
  customerRefreshTokenDays: Number(process.env.CUSTOMER_REFRESH_TOKEN_DAYS || 30),
  customerAccessTokenExpiresIn: Number(
    process.env.CUSTOMER_ACCESS_TOKEN_EXPIRES_IN ||
      Number(process.env.CUSTOMER_ACCESS_TOKEN_MINUTES || 15) * 60
  ),
  customerRefreshTokenExpiresIn: Number(
    process.env.CUSTOMER_REFRESH_TOKEN_EXPIRES_IN ||
      Number(process.env.CUSTOMER_REFRESH_TOKEN_DAYS || 30) * 86_400
  ),
  customerPasswordResetProofExpiresIn: Number(
    process.env.CUSTOMER_PASSWORD_RESET_PROOF_EXPIRES_IN || 600
  ),
  adminAccessTokenMinutes: Number(process.env.ADMIN_ACCESS_TOKEN_MINUTES || 10),
  adminRefreshTokenDays: Number(process.env.ADMIN_REFRESH_TOKEN_DAYS || 7),
  adminAccessTokenExpiresIn: Number(
    process.env.ADMIN_ACCESS_TOKEN_EXPIRES_IN || 900
  ),
  adminRefreshTokenExpiresIn: Number(
    process.env.ADMIN_REFRESH_TOKEN_EXPIRES_IN || 2_592_000
  ),
  adminInvitationExpiresIn: Number(process.env.ADMIN_INVITATION_EXPIRES_IN_SECONDS || process.env.ADMIN_INVITATION_EXPIRES_IN || 86_400),
  adminActivationOtpExpiryMinutes: Number(process.env.ADMIN_ACTIVATION_OTP_EXPIRY_MINUTES || 10),
  adminActivationOtpMaxAttempts: Number(process.env.ADMIN_ACTIVATION_OTP_MAX_ATTEMPTS || 3),
  adminActivationOtpResendCooldownSeconds: Number(process.env.ADMIN_ACTIVATION_OTP_RESEND_COOLDOWN_SECONDS || 60),
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES || 10),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 3),
  otpResendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60),
  invitationExpiryHours: Number(process.env.ADMIN_INVITATION_EXPIRY_HOURS || 24),
  resendApiKey: process.env.RESEND_API_KEY || "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL || "",
  resendFromName: process.env.RESEND_FROM_NAME || ""
};
