import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const authLimiter = (max: number, code = "RATE_LIMIT_EXCEEDED") =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests, please try again later",
      code
    }
  });

// Mobile users commonly share carrier/NAT IPs. Keep an abuse guard, but avoid
// one person's retries blocking unrelated customers on the same connection.
export const registrationRateLimiter = authLimiter(30);
export const emailVerificationRateLimiter = authLimiter(10);
export const verificationResendRateLimiter = authLimiter(5);
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip || "unknown")}:${String(
      req.body?.identifier ?? ""
    ).toLocaleLowerCase("en")}`,
  message: {
    success: false,
    message: "Too many login attempts, please try again later",
    code: "LOGIN_RATE_LIMITED"
  }
});
export const forgotPasswordRateLimiter = authLimiter(5);
export const passwordResetVerificationRateLimiter = authLimiter(10);
export const passwordResetRateLimiter = authLimiter(5);
export const sessionRefreshRateLimiter = authLimiter(30);
export const passwordChangeRateLimiter = authLimiter(5);
export const marketplaceInterestRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user?.id ?? ipKeyGenerator(req.ip || "unknown")}:${req.params.propertyId ?? "unknown"}`,
  message: { success: false, message: "Please wait before submitting interest in this property again", code: "RATE_LIMIT_EXCEEDED" }
});
export const referralSubmissionRateLimiter = authLimiter(10, "REFERRAL_SUBMISSION_RATE_LIMITED");
export const referralOtpRequestRateLimiter = authLimiter(5, "REFERRAL_OTP_RATE_LIMITED");
export const referralOtpVerifyRateLimiter = authLimiter(10, "REFERRAL_OTP_RATE_LIMITED");
export const adminLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip || "unknown")}:${String(req.body?.email ?? "").toLowerCase()}`,
  message: { success: false, message: "Too many Admin login attempts, please try again later", code: "ADMIN_LOGIN_RATE_LIMITED" }
});
export const adminOtpRateLimiter = authLimiter(10, "ADMIN_LOGIN_RATE_LIMITED");
export const adminInvitationRateLimiter = authLimiter(5, "ADMIN_INVITATION_COOLDOWN");
export const adminSessionRefreshRateLimiter = authLimiter(30, "ADMIN_SESSION_REFRESH_RATE_LIMITED");
export const adminPasswordChangeRateLimiter = authLimiter(5, "ADMIN_PASSWORD_CHANGE_RATE_LIMITED");
export const adminReferralPaymentRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user?.id ?? ipKeyGenerator(req.ip || "unknown")}:${req.params.referralId ?? "unknown"}`,
  message: { success: false, message: "Too many payment attempts, please try again later", code: "REFERRAL_PAYMENT_RATE_LIMITED" }
});
export const locationSearchRateLimiter = authLimiter(60, "LOCATION_SEARCH_RATE_LIMITED");
