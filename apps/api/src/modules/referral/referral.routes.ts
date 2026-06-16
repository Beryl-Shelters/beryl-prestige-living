import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  generatePropertyReferralLinkController,
  generateSellerReferralLinkController,
  getMyReferralListController,
  getReferralDashboardController,
  trackReferralController,
  updateReferralStatusController
} from "./referral.controller";
import {
  trackReferralSchema,
  updateReferralStatusSchema
} from "./referral.validators";

const router = Router();

router.get("/me", authMiddleware, getReferralDashboardController);

router.get("/me/list", authMiddleware, getMyReferralListController);

router.post(
  "/property/:propertyId/share-link",
  authMiddleware,
  generatePropertyReferralLinkController
);

router.post(
  "/seller/share-link",
  authMiddleware,
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