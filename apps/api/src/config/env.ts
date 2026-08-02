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

  clientWebUrl: process.env.CLIENT_WEB_URL || "http://localhost:3000",
  clientMobileUrl: process.env.CLIENT_MOBILE_URL || "",
  apiBaseUrl: process.env.API_BASE_URL || "",

  initialSuperAdminPassword: process.env.INITIAL_SUPER_ADMIN_PASSWORD || "",
  otpSecret: process.env.OTP_HASH_SECRET || "",
  customerSessionTokenSecret: process.env.CUSTOMER_SESSION_TOKEN_SECRET || "",
  adminSessionTokenSecret: process.env.ADMIN_SESSION_TOKEN_SECRET || "",
  customerAccessTokenMinutes: Number(process.env.CUSTOMER_ACCESS_TOKEN_MINUTES || 15),
  customerRefreshTokenDays: Number(process.env.CUSTOMER_REFRESH_TOKEN_DAYS || 30),
  adminAccessTokenMinutes: Number(process.env.ADMIN_ACCESS_TOKEN_MINUTES || 10),
  adminRefreshTokenDays: Number(process.env.ADMIN_REFRESH_TOKEN_DAYS || 7),
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES || 10),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 3),
  otpResendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60),
  invitationExpiryHours: Number(process.env.ADMIN_INVITATION_EXPIRY_HOURS || 24),
  mailProviderApiUrl: process.env.MAIL_PROVIDER_API_URL || "",
  mailProviderApiKey: process.env.MAIL_PROVIDER_API_KEY || "",
  mailFrom: process.env.MAIL_FROM || ""
};
