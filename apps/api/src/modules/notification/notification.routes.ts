import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  deleteNotificationController,
  getMyNotificationsController,
  getUnreadNotificationCountController,
  markAllNotificationsAsReadController,
  markNotificationAsReadController,
  sendAdminNotificationController
} from "./notification.controller";
import { createNotificationSchema } from "./notification.validators";

const router = Router();

router.get(
  "/me",
  authMiddleware,
  getMyNotificationsController
);

router.get(
  "/unread-count",
  authMiddleware,
  getUnreadNotificationCountController
);

router.patch(
  "/read-all",
  authMiddleware,
  markAllNotificationsAsReadController
);

router.post(
  "/admin/send",
  authMiddleware,
  requireRoles(["admin", "super_admin"]),
  validate(createNotificationSchema),
  sendAdminNotificationController
);

router.patch(
  "/:id/read",
  authMiddleware,
  markNotificationAsReadController
);

router.delete(
  "/:id",
  authMiddleware,
  deleteNotificationController
);

export default router;