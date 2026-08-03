import { Router } from "express";
import { requireVerifiedCustomer } from "../../middlewares/customer-auth.middleware";
import { customerSessionMiddleware } from "../../middlewares/customer-session.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  activatePersona,
  getPersonas,
  switchActivePersona
} from "./customer-onboarding.controller";
import {
  activatePersonaSchema,
  switchPersonaSchema
} from "./customer.validators";

const router = Router();

router.use(customerSessionMiddleware, requireVerifiedCustomer);

router.get("/", getPersonas);
router.post(
  "/activate",
  validate(activatePersonaSchema, "INVALID_PERSONA_TYPE"),
  activatePersona
);
router.patch(
  "/active",
  validate(switchPersonaSchema, "INVALID_PERSONA_TYPE"),
  switchActivePersona
);

export default router;
