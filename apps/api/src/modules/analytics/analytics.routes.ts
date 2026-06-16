import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import {
  getAdminDashboardAnalyticsController,
  getMyPropertyAnalyticsController,
  getPropertyStatsController,
  trackPropertyShareController,
  trackPropertyViewController
} from "./analytics.controller";

const router = Router();

router.post("/properties/:id/view", trackPropertyViewController);

router.post("/properties/:id/share", trackPropertyShareController);

router.get(
  "/properties/:id/stats",
  authMiddleware,
  getPropertyStatsController
);

router.get(
  "/my-properties",
  authMiddleware,
  requireRoles([
    "property_developer",
    "landlord",
    "registered_agent",
    "freelance_agent",
    "admin",
    "super_admin"
  ]),
  getMyPropertyAnalyticsController
);

router.get(
  "/dashboard",
  authMiddleware,
  requireRoles(["admin", "super_admin"]),
  getAdminDashboardAnalyticsController
);

export default router;