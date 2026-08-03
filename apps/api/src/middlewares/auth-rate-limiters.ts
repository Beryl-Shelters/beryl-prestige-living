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

export const registrationRateLimiter = authLimiter(5);
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
