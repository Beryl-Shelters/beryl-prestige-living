import { Router } from "express";
import { requireVerifiedCustomer } from "../../middlewares/customer-auth.middleware";
import { customerSessionMiddleware } from "../../middlewares/customer-session.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  buyerOnboardingSchema,
  sellerOnboardingSchema
} from "./customer.validators";
import {
  completeBuyerOnboarding,
  completeSellerOnboarding,
  getOnboardingStatus
} from "./customer-onboarding.controller";

const router = Router();

router.use(customerSessionMiddleware, requireVerifiedCustomer);

router.get("/status", getOnboardingStatus);
router.patch(
  "/buyer",
  validate(buyerOnboardingSchema, "ONBOARDING_VALIDATION_ERROR"),
  completeBuyerOnboarding
);
router.patch(
  "/seller",
  validate(sellerOnboardingSchema, "ONBOARDING_VALIDATION_ERROR"),
  completeSellerOnboarding
);

export default router;
