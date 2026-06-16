import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";

import {
  overviewController,
  investmentsController,
  recentMessagesController,
  recentPropertiesController,
  adminSummaryController
} from "./dashboard.controller";

const router = Router();

router.use(authMiddleware);

// user dashboard
router.get("/overview", overviewController);
router.get("/investments", investmentsController);
router.get("/recent-messages", recentMessagesController);
router.get("/recent-properties", recentPropertiesController);

// admin only
router.get(
  "/admin-summary",
  requireRoles(["admin", "super_admin"]),
  adminSummaryController
);

export default router;