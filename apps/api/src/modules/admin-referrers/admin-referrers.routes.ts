import { Router } from "express";
import { adminSessionMiddleware, requireAdminRole } from "../../middlewares/admin-session.middleware";
import { uploadReferralPaymentReceipt } from "../../middlewares/upload.middleware";
import { adminReferralPaymentRateLimiter } from "../../middlewares/auth-rate-limiters";
import * as controller from "./admin-referrers.controller";

const router = Router();
router.use(adminSessionMiddleware, requireAdminRole("ADMIN", "SUPER_ADMIN"));
router.get("/", controller.list);
router.get("/:referrerId", controller.detail);
router.get("/:referrerId/referrals/:referralId/payment-preparation", controller.paymentPreparation);
router.post("/:referrerId/referrals/:referralId/mark-paid", adminReferralPaymentRateLimiter, uploadReferralPaymentReceipt, controller.markPaid);
router.get("/:referrerId/referrals/:referralId/payment/receipt/access", controller.receiptAccess);

export default router;
