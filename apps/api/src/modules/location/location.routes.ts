import { Router } from "express";
import { locationSearchRateLimiter } from "../../middlewares/auth-rate-limiters";
import * as controller from "./location.controller";

const router = Router();

router.get("/search", locationSearchRateLimiter, controller.search);

export default router;
