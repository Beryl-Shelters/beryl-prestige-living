import { Router } from "express";
import { adminSessionMiddleware, requireAdminRole } from "../../middlewares/admin-session.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./admin-marketplace.controller";
import { approveMarketplacePropertySchema, rejectMarketplacePropertySchema } from "./admin-marketplace.validators";

const router = Router();
router.use(adminSessionMiddleware, requireAdminRole("ADMIN", "SUPER_ADMIN"));
router.get("/properties", controller.list);
router.get("/properties/:propertyId", controller.detail);
router.get("/properties/:propertyId/documents/:documentId/access", controller.documentAccess);
router.post("/properties/:propertyId/approve", validate(approveMarketplacePropertySchema, "INVALID_APPROVAL_REQUEST"), controller.approve);
router.post("/properties/:propertyId/reject", validate(rejectMarketplacePropertySchema, "REJECTION_REASON_INVALID"), controller.reject);
export default router;
