import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createTransactionController,
  getAdminTransactionsController,
  getMyTransactionsController,
  getTransactionByIdController,
  updateTransactionStatusController
} from "./transaction.controller";
import {
  createTransactionSchema,
  updateTransactionStatusSchema
} from "./transaction.validators";

const router = Router();

router.post(
  "/",
  authMiddleware,
  requireRoles(["admin", "super_admin"]),
  validate(createTransactionSchema),
  createTransactionController
);

router.get(
  "/me",
  authMiddleware,
  getMyTransactionsController
);

router.get(
  "/admin",
  authMiddleware,
  requireRoles(["admin", "super_admin"]),
  getAdminTransactionsController
);

router.get(
  "/:id",
  authMiddleware,
  getTransactionByIdController
);

router.patch(
  "/:id/status",
  authMiddleware,
  requireRoles(["admin", "super_admin"]),
  validate(updateTransactionStatusSchema),
  updateTransactionStatusController
);

export default router;