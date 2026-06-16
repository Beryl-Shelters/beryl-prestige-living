import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  createListingController,
  deleteListingController,
  getListingByIdController,
  getMyListingsController,
  listListingsController,
  updateListingController,
  updateListingStatusController
} from "./listing.controller";
import {
  createListingSchema,
  updateListingSchema,
  updateListingStatusSchema
} from "./listing.validators";

const router = Router();

router.get("/", listListingsController);

router.get(
  "/me",
  authMiddleware,
  getMyListingsController
);

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
  validate(createListingSchema),
  createListingController
);

router.get("/:id", getListingByIdController);

router.patch(
  "/:id",
  authMiddleware,
  validate(updateListingSchema),
  updateListingController
);

router.patch(
  "/:id/status",
  authMiddleware,
  requireRoles(["admin", "super_admin"]),
  validate(updateListingStatusSchema),
  updateListingStatusController
);

router.delete(
  "/:id",
  authMiddleware,
  deleteListingController
);

export default router;