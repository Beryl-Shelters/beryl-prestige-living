import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createInquiryController,
  getInquiryByIdController,
  getMyInquiriesController,
  updateInquiryStatusController
} from "./inquiry.controller";
import {
  createInquirySchema,
  updateInquiryStatusSchema
} from "./inquiry.validators";

const router = Router();

router.post(
  "/",
  validate(createInquirySchema),
  createInquiryController
);

router.get(
  "/me",
  authMiddleware,
  getMyInquiriesController
);

router.get(
  "/:id",
  authMiddleware,
  getInquiryByIdController
);

router.patch(
  "/:id/status",
  authMiddleware,
  requireRoles(["admin", "support_agent", "super_admin"]),
  validate(updateInquiryStatusSchema),
  updateInquiryStatusController
);

export default router;