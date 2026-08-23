import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  approveAdminPropertyController,
  getAdminDashboardController,
  getPendingListingsController,
  getPendingMandatesController,
  getPendingPropertiesController,
  getPendingReportsController,
  rejectAdminPropertyController
} from "./admin.controller";
import {
  rejectPropertySchema
} from "./admin.validators";
import {
  createSuperAdminUserController,
  deactivateSuperAdminUserController,
  getAuditLogsController,
  getSystemStatsController,
  updateSuperAdminUserRoleController
} from "./admin.controller";

import {
  createAdminUserSchema,
  updateUserRoleSchema
} from "./admin.validators";



const router = Router();

router.use(authMiddleware);
router.use(requireRoles(["admin", "super_admin"]));

router.get("/dashboard", getAdminDashboardController);

router.get("/properties/pending", getPendingPropertiesController);

router.patch("/properties/:id/approve", approveAdminPropertyController);

router.patch(
  "/properties/:id/reject",
  validate(rejectPropertySchema),
  rejectAdminPropertyController
);

router.get("/listings/pending", getPendingListingsController);

router.get("/reports/pending", getPendingReportsController);

router.get("/mandates/pending", getPendingMandatesController);

router.post(
  "/super-admin/users",
  requireRoles(["super_admin"]),
  validate(createAdminUserSchema),
  createSuperAdminUserController
);

router.patch(
  "/super-admin/users/:id/role",
  requireRoles(["super_admin"]),
  validate(updateUserRoleSchema),
  updateSuperAdminUserRoleController
);

router.delete(
  "/super-admin/users/:id",
  requireRoles(["super_admin"]),
  deactivateSuperAdminUserController
);

router.get(
  "/super-admin/audit-logs",
  requireRoles(["super_admin"]),
  getAuditLogsController
);

router.get(
  "/super-admin/system-stats",
  requireRoles(["super_admin"]),
  getSystemStatsController
);

export default router;
