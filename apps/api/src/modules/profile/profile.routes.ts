import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { upload } from "../../middlewares/upload.middleware";
import {
  changePassword,
  getProfile,
  updateAvatar,
  updateProfile
} from "./profile.controller";
import {
  changePasswordSchema,
  updateProfileSchema
} from "./profile.validators";

const router = Router();

router.get("/me", authMiddleware, getProfile);

router.patch(
  "/me",
  authMiddleware,
  validate(updateProfileSchema),
  updateProfile
);

router.patch(
  "/me/password",
  authMiddleware,
  validate(changePasswordSchema),
  changePassword
);

router.patch(
  "/me/avatar",
  authMiddleware,
  upload.single("avatar"),
  updateAvatar
);

export default router;