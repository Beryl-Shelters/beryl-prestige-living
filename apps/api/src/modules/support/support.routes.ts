import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  addSupportTicketMessageController,
  assignSupportTicketController,
  createSupportTicketController,
  getAllSupportTicketsController,
  getMySupportTicketsController,
  getSupportTicketByIdController,
  updateSupportTicketStatusController
} from "./support.controller";
import {
  assignTicketSchema,
  createSupportTicketSchema,
  createTicketMessageSchema,
  updateTicketStatusSchema
} from "./support.validators";

const router = Router();

router.post(
  "/tickets",
  authMiddleware,
  validate(createSupportTicketSchema),
  createSupportTicketController
);

router.get(
  "/tickets/me",
  authMiddleware,
  getMySupportTicketsController
);

router.get(
  "/admin/tickets",
  authMiddleware,
  requireRoles(["admin", "support_agent", "super_admin"]),
  getAllSupportTicketsController
);

router.get(
  "/tickets/:id",
  authMiddleware,
  getSupportTicketByIdController
);

router.post(
  "/tickets/:id/messages",
  authMiddleware,
  validate(createTicketMessageSchema),
  addSupportTicketMessageController
);

router.patch(
  "/tickets/:id/status",
  authMiddleware,
  requireRoles(["admin", "support_agent", "super_admin"]),
  validate(updateTicketStatusSchema),
  updateSupportTicketStatusController
);

router.patch(
  "/tickets/:id/assign",
  authMiddleware,
  requireRoles(["admin", "super_admin"]),
  validate(assignTicketSchema),
  assignSupportTicketController
);

export default router;