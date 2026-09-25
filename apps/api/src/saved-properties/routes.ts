import { Router, type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { AuthConfig } from "../auth/config.js";
import { AuthError, expired } from "../auth/errors.js";
import type { AuthGateway } from "../auth/gateway.js";
import { AuthSessions } from "../auth/sessions.js";
import { savedPropertiesQuery, savedPropertyInput, savedPropertyParams, savedPropertyStatesQuery } from "./model.js";
import type { SavedPropertiesRepository } from "./repository.js";

const wrap = (fn: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response, next: NextFunction) => { void fn(request, response).catch(next); };

export function savedPropertiesRouter(config: AuthConfig, gateway: AuthGateway, repository: SavedPropertiesRepository) {
  const router = Router(), sessions = new AuthSessions(config, gateway);
  router.use((request, response, next) => {
    response.setHeader("Cache-Control", "no-store"); response.vary("Cookie");
    if (request.method !== "GET" && (request.headers.origin !== config.webOrigin || !request.is("application/json")))
      return next(new AuthError(403, "UNTRUSTED_ORIGIN", "This request is not permitted."));
    next();
  });
  router.use(rateLimit({ windowMs: 60000, limit: 60, skip: request => request.method === "GET", standardHeaders: "draft-7", legacyHeaders: false,
    message: { success: false, error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } } }));
  router.use((request, response, next) => { void (async () => {
    const tokens = await sessions.account(request), customer = await gateway.findCustomer("id", tokens.userId);
    if (!customer?.email_verified_at) throw expired();
    response.locals.savedPropertyOwner = tokens.userId; next();
  })().catch(next); });
  const owner = (response: Response) => response.locals.savedPropertyOwner as string;
  router.get("/", wrap(async (request, response) => {
    if (request.body && Object.keys(request.body).length) throw new AuthError(400, "INVALID_SAVED_PROPERTIES_QUERY", "Check the saved-property search.");
    response.json({ success: true, data: await repository.list(owner(response), savedPropertiesQuery.parse(request.query)) });
  }));
  router.get("/states", wrap(async (request, response) => {
    response.json({ success: true, data: { propertyCodes: await repository.states(owner(response), savedPropertyStatesQuery.parse(request.query).codes) } });
  }));
  router.post("/", wrap(async (request, response) => {
    if (Object.keys(request.query).length) throw new AuthError(400, "INVALID_SAVED_PROPERTY", "Check the property details.");
    const { propertyCode } = savedPropertyInput.parse(request.body);
    await repository.save(owner(response), propertyCode);
    response.status(201).json({ success: true, data: { propertyCode, saved: true } });
  }));
  router.delete("/:propertyCode", wrap(async (request, response) => {
    if (Object.keys(request.query).length || request.body && Object.keys(request.body).length) throw new AuthError(400, "INVALID_SAVED_PROPERTY", "Check the property details.");
    const { propertyCode } = savedPropertyParams.parse(request.params);
    await repository.remove(owner(response), propertyCode);
    response.json({ success: true, data: { propertyCode, saved: false } });
  }));
  return router;
}
