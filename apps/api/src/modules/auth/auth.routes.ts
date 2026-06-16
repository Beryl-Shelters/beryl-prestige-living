import { Router } from "express";
import { login, logout, me, register } from "./auth.controller";
import { validate } from "../../middlewares/validate.middleware";
import { loginSchema, registerSchema } from "./auth.validator";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/logout", authMiddleware, logout);
router.get("/me", authMiddleware, me);

export default router;