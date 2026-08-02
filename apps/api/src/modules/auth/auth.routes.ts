import { Router } from "express";
import {
  login,
  logout,
  me,
  register,
  resendVerificationOtp,
  verifyEmail
} from "./auth.controller";
import { validate } from "../../middlewares/validate.middleware";
import { loginSchema } from "./auth.validator";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  customerRegisterSchema,
  resendCustomerVerificationSchema,
  verifyCustomerEmailSchema
} from "../auth-onboarding/customer.validators";
import {
  emailVerificationRateLimiter,
  registrationRateLimiter,
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
router.post("/login", validate(loginSchema), login);
router.post("/logout", authMiddleware, logout);
router.get("/me", authMiddleware, me);

export default router;
