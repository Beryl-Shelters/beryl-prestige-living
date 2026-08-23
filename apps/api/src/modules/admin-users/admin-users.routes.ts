import { Router } from "express";
import { adminSessionMiddleware, requireAdminRole } from "../../middlewares/admin-session.middleware";
import * as controller from "./admin-users.controller";

const router = Router();
router.use(adminSessionMiddleware, requireAdminRole("ADMIN", "SUPER_ADMIN"));
router.get("/", controller.list);
router.get("/:userId", controller.detail);
export default router;
