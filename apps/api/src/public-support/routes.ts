import { Router, type Request, type Response, type NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { AuthError } from "../auth/errors.js";
import type { AuthConfig } from "../auth/config.js";
import type { PublicSupportRepository } from "./repository.js";

const noControls = (value: string) => [...value].every(char => { const point = char.codePointAt(0)!; return point > 31 && point !== 127; });
const reasonControls = (value: string) => [...value].every(char => { const point = char.codePointAt(0)!; return (point > 31 && point !== 127) || point === 10 || point === 13; });
const reportSchema = z.strictObject({
  reportType: z.literal("AGENT"),
  agentId: z.string().trim().min(1).max(80).refine(noControls, "Agent ID contains invalid characters."),
  agentName: z.string().trim().max(120).refine(noControls, "Agent name contains invalid characters.").optional(),
  reason: z.string().trim().min(1).max(3000).refine(reasonControls, "Reason contains invalid characters."),
});
const wrap = (fn: (request: Request, response: Response) => Promise<void>) => (request: Request, response: Response, next: NextFunction) => { void fn(request, response).catch(next); };

export function publicSupportRouter(config: AuthConfig, repository: PublicSupportRepository) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  router.post("/reports", rateLimit({ windowMs: 3600000, limit: 25, standardHeaders: "draft-7", legacyHeaders: false,
    message: { success: false, error: { code: "RATE_LIMITED", message: "Too many reports. Please try again later." } } }), wrap(async (req, res) => {
    if (req.headers.origin !== config.webOrigin) throw new AuthError(403, "UNTRUSTED_ORIGIN", "This request is not permitted.");
    if (!req.is("application/json")) throw new AuthError(415, "JSON_REQUIRED", "Submit the report as JSON.");
    if (Object.keys(req.query).length) throw new AuthError(400, "INVALID_REPORT", "Check the supplied report fields.");
    const report = reportSchema.parse(req.body);
    try { await repository.submit({ reportType: report.reportType, agentId: report.agentId,
      agentName: report.agentName || null, reason: report.reason }); }
    catch { throw new AuthError(503, "SUPPORT_UNAVAILABLE", "Your report could not be submitted. Please try again."); }
    res.status(201).json({ success: true, data: { recorded: true } });
  }));
  return router;
}
