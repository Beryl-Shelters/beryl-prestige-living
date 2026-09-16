import { Router, type Request, type Response, type NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { AuthError } from "../auth/errors.js";
import type { AuthConfig } from "../auth/config.js";
import type { PublicAnalyticsRepository } from "./repository.js";

const wrap = (fn: (request: Request, response: Response) => Promise<void>) => (request: Request, response: Response, next: NextFunction) => { void fn(request, response).catch(next); };
const limited = { success: false, error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } };

export function publicAnalyticsRouter(config: AuthConfig, repository: PublicAnalyticsRepository) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  router.get("/analytics", rateLimit({ windowMs: 60000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false, message: limited }), wrap(async (req, res) => {
    const keys = Object.keys(req.query);
    if (keys.some(key => key !== "period") || Array.isArray(req.query.period) || typeof req.query.period === "object" ||
      ![undefined, "monthly", "annually"].includes(req.query.period as string | undefined)) {
      throw new AuthError(400, "INVALID_ANALYTICS_QUERY", "Choose Monthly or Annually.");
    }
    const period = (req.query.period ?? "monthly") as "monthly" | "annually";
    try { res.json({ success: true, data: await repository.read(period) }); }
    catch { throw new AuthError(503, "ANALYTICS_UNAVAILABLE", "Analytics is temporarily unavailable. Please try again."); }
  }));
  // Reserved for a completed first-party public property search in the future.
  // Origin checks and per-IP limits reduce abuse; unauthenticated activity
  // counts cannot be made fraud-proof without a stronger product contract.
  router.post("/property-searches", rateLimit({ windowMs: 60000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false, message: limited }), wrap(async (req, res) => {
    if (req.headers.origin !== config.webOrigin || !req.is("application/json")) throw new AuthError(403, "UNTRUSTED_ORIGIN", "This request is not permitted.");
    if (Object.keys(req.query).length || !req.body || typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length) {
      throw new AuthError(400, "INVALID_SEARCH_EVENT", "Invalid search event.");
    }
    try { await repository.recordSearch(); }
    catch { throw new AuthError(503, "SEARCH_TRACKING_UNAVAILABLE", "Search is temporarily unavailable. Please try again."); }
    res.status(201).json({ success: true, data: { recorded: true } });
  }));
  return router;
}
