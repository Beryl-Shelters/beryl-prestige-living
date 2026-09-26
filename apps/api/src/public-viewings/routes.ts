import { Router, type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { AuthConfig } from "../auth/config.js";
import { AuthError } from "../auth/errors.js";
import { propertyViewingInput } from "./model.js";
import type { PropertyViewingsRepository } from "./repository.js";

const wrap = (fn: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response, next: NextFunction) => { void fn(request, response).catch(next); };

export function publicPropertyViewingsRouter(config: AuthConfig, repository: PropertyViewingsRepository) {
  const router = Router();
  router.use((_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
  router.post("/", rateLimit({ windowMs: 3600000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false,
    message: { success: false, error: { code: "RATE_LIMITED", message: "Too many viewing requests. Please try again later." } } }), wrap(async (request, response) => {
    if (request.headers.origin !== config.webOrigin) throw new AuthError(403, "UNTRUSTED_ORIGIN", "This request is not permitted.");
    if (!request.is("application/json")) throw new AuthError(415, "JSON_REQUIRED", "Submit the viewing request as JSON.");
    if (Object.keys(request.query).length) throw new AuthError(400, "INVALID_VIEWING", "Check the supplied viewing fields.");
    const input = propertyViewingInput.parse(request.body);
    let recorded: boolean;
    try { recorded = await repository.submit(input); }
    catch { throw new AuthError(503, "VIEWING_UNAVAILABLE", "Your viewing could not be scheduled. Please try again."); }
    if (!recorded) throw new AuthError(404, "PROPERTY_NOT_FOUND", "Property not found.");
    response.status(201).json({ success: true, data: { recorded: true } });
  }));
  return router;
}
