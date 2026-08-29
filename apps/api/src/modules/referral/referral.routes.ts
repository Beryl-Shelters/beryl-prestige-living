import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { customerSessionMiddleware, optionalCustomerSessionMiddleware } from "../../middlewares/customer-session.middleware";
import { referralOtpRequestRateLimiter, referralOtpVerifyRateLimiter, referralSubmissionRateLimiter } from "../../middlewares/auth-rate-limiters";
import {
  getBankDirectoryController,
  getCanonicalReferralDashboardController,
  getPayoutDetailsController,
  getReferralContextController,
  generatePropertyReferralLinkController,
  generateSellerReferralLinkController,
  getMyReferralListController,
  getReferralDashboardController,
  requestReferralTrackingController,
  resolveReferralCodeController,
  savePayoutDetailsController,
  submitReferralController,
  trackReferralController,
  updateReferralStatusController,
  verifyReferralTrackingController
} from "./referral.controller";
import {
  payoutDetailsSchema,
  submitReferralSchema,
  trackingRequestSchema,
  trackingVerifySchema,
  trackReferralSchema,
  updateReferralStatusSchema
} from "./referral.validators";

const router = Router();

router.get("/context", optionalCustomerSessionMiddleware, getReferralContextController);
router.get("/links/:code", resolveReferralCodeController);
router.post("/", referralSubmissionRateLimiter, optionalCustomerSessionMiddleware, validate(submitReferralSchema, "REFERRAL_SUBMISSION_INVALID"), submitReferralController);
router.post("/tracking/request", referralOtpRequestRateLimiter, validate(trackingRequestSchema), requestReferralTrackingController);
router.post("/tracking/verify", referralOtpVerifyRateLimiter, validate(trackingVerifySchema), verifyReferralTrackingController);
router.get("/dashboard", optionalCustomerSessionMiddleware, getCanonicalReferralDashboardController);
router.get("/banks", getBankDirectoryController);
router.get("/payout-details", optionalCustomerSessionMiddleware, getPayoutDetailsController);
router.put("/payout-details", optionalCustomerSessionMiddleware, validate(payoutDetailsSchema, "PAYOUT_DETAILS_INVALID"), savePayoutDetailsController);

router.get("/me", customerSessionMiddleware, getReferralDashboardController);

router.get("/me/list", customerSessionMiddleware, getMyReferralListController);

router.post(
  "/property/:propertyId/share-link",
  customerSessionMiddleware,
  generatePropertyReferralLinkController
);

router.post(
  "/seller/share-link",
  customerSessionMiddleware,
  generateSellerReferralLinkController
);

router.post(
  "/track",
  validate(trackReferralSchema),
  trackReferralController
);

router.patch(
  "/:id/status",
  authMiddleware,
  requireRoles(["admin", "super_admin"]),
  validate(updateReferralStatusSchema),
  updateReferralStatusController
);

export default router;
