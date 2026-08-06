import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware";
import { adminInvitationRateLimiter, adminOtpRateLimiter } from "../../middlewares/auth-rate-limiters";
import { adminSessionMiddleware, requireAdminRole } from "../../middlewares/admin-session.middleware";
import { beginAdminActivationSchema, inviteAdminSchema, resendAdminActivationOtpSchema, setAdminPasswordSchema, verifyAdminActivationOtpSchema } from "../auth-onboarding/admin.validators";
import * as controller from "./admin-auth.controller";

const router = Router();
router.post("/staff/invite", adminSessionMiddleware, requireAdminRole("SUPER_ADMIN"), adminInvitationRateLimiter, validate(inviteAdminSchema), controller.invite);
router.post("/staff/:adminId/resend-invitation", adminSessionMiddleware, requireAdminRole("SUPER_ADMIN"), adminInvitationRateLimiter, controller.resendInvitation);
router.post("/auth/activate", adminOtpRateLimiter, validate(beginAdminActivationSchema), controller.activate);
router.post("/auth/resend-activation-otp", adminOtpRateLimiter, validate(resendAdminActivationOtpSchema), controller.resendActivationOtp);
router.post("/auth/verify-activation-otp", adminOtpRateLimiter, validate(verifyAdminActivationOtpSchema), controller.verifyActivationOtp);
router.post("/auth/set-password", adminOtpRateLimiter, validate(setAdminPasswordSchema, "PASSWORD_VALIDATION_ERROR"), controller.setPassword);
export default router;
