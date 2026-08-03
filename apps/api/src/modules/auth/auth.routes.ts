import { Router } from "express";
import {
  changePassword,
  forgotPassword,
  login,
  logout,
  me,
  register,
  refreshSession,
  resetPassword,
  resendVerificationOtp,
  verifyEmail,
  verifyPasswordResetOtp
} from "./auth.controller";
import { validate } from "../../middlewares/validate.middleware";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireVerifiedCustomer } from "../../middlewares/customer-auth.middleware";
import {
  customerLogoutMiddleware,
  customerSessionMiddleware
} from "../../middlewares/customer-session.middleware";
import {
  changeCustomerPasswordSchema,
  customerLoginSchema,
  customerRegisterSchema,
  forgotCustomerPasswordSchema,
  logoutCustomerSessionSchema,
  refreshCustomerSessionSchema,
  resetCustomerPasswordSchema,
  resendCustomerVerificationSchema,
  verifyCustomerEmailSchema,
  verifyCustomerPasswordResetSchema
} from "../auth-onboarding/customer.validators";
import {
  emailVerificationRateLimiter,
  forgotPasswordRateLimiter,
  loginRateLimiter,
  passwordChangeRateLimiter,
  passwordResetRateLimiter,
  passwordResetVerificationRateLimiter,
  registrationRateLimiter,
  sessionRefreshRateLimiter,
  verificationResendRateLimiter
} from "../../middlewares/auth-rate-limiters";

const router = Router();

router.post(
  "/register",
  registrationRateLimiter,
  validate(customerRegisterSchema),
  register
);
router.post(
  "/verify-email",
  emailVerificationRateLimiter,
  validate(verifyCustomerEmailSchema),
  verifyEmail
);
router.post(
  "/resend-verification-otp",
  verificationResendRateLimiter,
  validate(resendCustomerVerificationSchema),
  resendVerificationOtp
);
router.post(
  "/login",
  validate(customerLoginSchema),
  loginRateLimiter,
  login
);
router.post(
  "/forgot-password",
  validate(forgotCustomerPasswordSchema),
  forgotPasswordRateLimiter,
  forgotPassword
);
router.post(
  "/verify-password-reset-otp",
  validate(verifyCustomerPasswordResetSchema),
  passwordResetVerificationRateLimiter,
  verifyPasswordResetOtp
);
router.post(
  "/reset-password",
  validate(resetCustomerPasswordSchema, "PASSWORD_VALIDATION_ERROR"),
  passwordResetRateLimiter,
  resetPassword
);
router.post(
  "/refresh",
  validate(refreshCustomerSessionSchema),
  sessionRefreshRateLimiter,
  refreshSession
);
router.post(
  "/logout",
  customerLogoutMiddleware,
  validate(logoutCustomerSessionSchema),
  logout
);
router.patch(
  "/change-password",
  customerSessionMiddleware,
  requireVerifiedCustomer,
  validate(changeCustomerPasswordSchema, "PASSWORD_VALIDATION_ERROR"),
  passwordChangeRateLimiter,
  changePassword
);
router.get("/me", authMiddleware, me);

export default router;
