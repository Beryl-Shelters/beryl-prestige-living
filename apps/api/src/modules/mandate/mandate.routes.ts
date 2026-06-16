import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { upload } from "../../middlewares/upload.middleware";
import {
  createMandateController,
  deleteMandateController,
  getAdminMandatesController,
  getMandateByIdController,
  getMyMandatesController,
  reviewMandateController
} from "./mandate.controller";
import {
  createMandateSchema,
  reviewMandateSchema
} from "./mandate.validators";

const router = Router();

router.post(
  "/",
  authMiddleware,
  upload.single("document"),
  validate(createMandateSchema),
  createMandateController
);

router.get(
  "/me",
  authMiddleware,
  getMyMandatesController
);

router.get(
  "/admin",
  authMiddleware,
  requireRoles(["admin", "support_agent", "super_admin"]),
  getAdminMandatesController
);

router.get(
  "/:id",
  authMiddleware,
  getMandateByIdController
);

router.patch(
  "/:id/review",
  authMiddleware,
  requireRoles(["admin", "support_agent", "super_admin"]),
  validate(reviewMandateSchema),
  reviewMandateController
);

router.delete(
  "/:id",
  authMiddleware,
  deleteMandateController
);

export default router;