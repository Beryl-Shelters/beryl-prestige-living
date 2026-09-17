import { Router, type Request, type Response, type NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { AuthError } from "../auth/errors.js";
import { publicPropertyQuery } from "./model.js";
import type { PublicPropertiesRepository } from "./repository.js";

const wrap = (fn: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response, next: NextFunction) => { void fn(request, response).catch(next); };

export function publicPropertiesRouter(repository: PublicPropertiesRepository) {
  const router = Router();
  router.use((_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
  router.get("/", rateLimit({ windowMs: 60000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false,
    message: { success: false, error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } } }), wrap(async (request, response) => {
    const query = publicPropertyQuery.parse(request.query);
    try { response.json({ success: true, data: await repository.list(query) }); }
    catch { throw new AuthError(503, "PROPERTIES_UNAVAILABLE", "Properties are temporarily unavailable. Please try again."); }
  }));
  return router;
}
