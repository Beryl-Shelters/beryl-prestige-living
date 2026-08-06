import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import { adminInvitationRateLimiter, adminOtpRateLimiter } from "../../middlewares/auth-rate-limiters";
import { adminSessionMiddleware, requireAdminRole } from "../../middlewares/admin-session.middleware";
import { adminLoginSchema, beginAdminActivationSchema, inviteAdminSchema, resendAdminActivationOtpSchema, resendAdminLoginOtpSchema, setAdminPasswordSchema, verifyAdminActivationOtpSchema, verifyAdminLoginOtpSchema } from "../auth-onboarding/admin.validators";
import { adminLoginRateLimiter } from "../../middlewares/auth-rate-limiters";
import * as controller from "./admin-auth.controller";

const router = Router();
router.post("/staff/invite", adminSessionMiddleware, requireAdminRole("SUPER_ADMIN"), adminInvitationRateLimiter, validate(inviteAdminSchema), controller.invite);
router.post("/staff/:adminId/resend-invitation", adminSessionMiddleware, requireAdminRole("SUPER_ADMIN"), adminInvitationRateLimiter, controller.resendInvitation);
router.post("/auth/activate", adminOtpRateLimiter, validate(beginAdminActivationSchema), controller.activate);
router.post("/auth/resend-activation-otp", adminOtpRateLimiter, validate(resendAdminActivationOtpSchema), controller.resendActivationOtp);
router.post("/auth/verify-activation-otp", adminOtpRateLimiter, validate(verifyAdminActivationOtpSchema), controller.verifyActivationOtp);
router.post("/auth/set-password", adminOtpRateLimiter, validate(setAdminPasswordSchema, "PASSWORD_VALIDATION_ERROR"), controller.setPassword);
router.post("/auth/login", adminLoginRateLimiter, validate(adminLoginSchema), controller.login);
router.post("/auth/resend-login-otp", adminOtpRateLimiter, validate(resendAdminLoginOtpSchema), controller.resendLoginOtp);
router.post("/auth/verify-login-otp", adminOtpRateLimiter, validate(verifyAdminLoginOtpSchema), controller.verifyLoginOtp);
export default router;
