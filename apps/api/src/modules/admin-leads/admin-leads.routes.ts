import { Router } from "express";
import { adminSessionMiddleware, requireAdminRole } from "../../middlewares/admin-session.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./admin-leads.controller";
import { updateAdminLeadStageSchema } from "./admin-leads.validators";

const router = Router();
router.use(adminSessionMiddleware, requireAdminRole("ADMIN", "SUPER_ADMIN"));
router.get("/", controller.list);
router.get("/:leadId", controller.detail);
router.patch("/:leadId/stage", validate(updateAdminLeadStageSchema, "INVALID_LEAD_STAGE_REQUEST"), controller.updateStage);

export default router;
