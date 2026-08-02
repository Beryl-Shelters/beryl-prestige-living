import rateLimit from "express-rate-limit";

const authLimiter = (max: number) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests, please try again later",
      code: "RATE_LIMIT_EXCEEDED"
    }
  });

export const registrationRateLimiter = authLimiter(5);
export const emailVerificationRateLimiter = authLimiter(10);
export const verificationResendRateLimiter = authLimiter(5);
