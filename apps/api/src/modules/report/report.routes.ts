import { Router } from "express";

import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { requireRoles } from "../../middlewares/role.middleware";

import {
  createReportController,
  getMyReportsController,
  getReportController,
  adminReportsController,
  reviewReportController,
  deleteReportController,
} from "./report.controller";

import { createReportSchema, reviewReportSchema } from "./report.validators";

const router = Router();

router.post(
  "/",
  authMiddleware,
  validate(createReportSchema),
  createReportController,
);

router.get("/me", authMiddleware, getMyReportsController);

router.get(
  "/admin",
  authMiddleware,
  requireRoles(["admin", "support_agent", "super_admin"]),
  adminReportsController,
);

router.get("/:id", authMiddleware, getReportController);

router.patch(
  "/:id/review",
  authMiddleware,
  requireRoles(["admin", "support_agent", "super_admin"]),
  validate(reviewReportSchema),
  reviewReportController,
);

router.delete("/:id", authMiddleware, deleteReportController);

export default router;
