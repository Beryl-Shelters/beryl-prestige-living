import { Router } from "express";
import {
  createPropertyController,
  deletePropertyController,
  getPropertyController,
  listPropertiesController,
  updatePropertyController
} from "./property.controller";
import {
  createPropertySchema,
  updatePropertySchema
} from "./property.validators";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { customerSessionMiddleware } from "../../middlewares/customer-session.middleware";
import { requireVerifiedCustomer } from "../../middlewares/customer-auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import {
  uploadPropertyImagesController,
  deletePropertyImageController
} from "./property.controller";
import { upload } from "../../middlewares/upload.middleware";
import {
  savePropertyController,
  unsavePropertyController,
  getMySavedPropertiesController
} from "./property.controller";

const router = Router();

router.get("/", listPropertiesController);

router.post(
  "/",
  authMiddleware,
  requireRoles([
    "property_developer",
    "landlord",
    "registered_agent",
    "freelance_agent",
    "admin",
    "super_admin"
  ]),
  validate(createPropertySchema),
  createPropertyController
);

router.post(
  "/:id/images",
  authMiddleware,
  upload.array("images", 10),
  uploadPropertyImagesController
);

router.delete(
  "/images/:imageId",
  authMiddleware,
  deletePropertyImageController
);


router.get(
  "/saved/me",
  customerSessionMiddleware,
  requireVerifiedCustomer,
  getMySavedPropertiesController
);

router.post(
  "/:id/save",
  customerSessionMiddleware,
  requireVerifiedCustomer,
  savePropertyController
);

router.delete(
  "/:id/save",
  customerSessionMiddleware,
  requireVerifiedCustomer,
  unsavePropertyController
);


router.get("/:id", getPropertyController);


router.patch(
  "/:id",
  authMiddleware,
  validate(updatePropertySchema),
  updatePropertyController
);

router.delete(
  "/:id",
  authMiddleware,
  deletePropertyController
);

export default router;
