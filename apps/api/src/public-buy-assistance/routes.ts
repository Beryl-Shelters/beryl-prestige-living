import { Router, type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { AuthConfig } from "../auth/config.js";
import { AuthError } from "../auth/errors.js";
import type { MediaStorage } from "../listings/media.js";
import { buyAssistanceInput } from "./model.js";
import type { BuyAssistanceRepository } from "./repository.js";
import { BuyAssistanceService } from "./service.js";
import { readBuyAssistance } from "./uploads.js";

const wrap = (fn: (request: Request, response: Response) => Promise<void>) => (request: Request, response: Response, next: NextFunction) => { void fn(request, response).catch(next); };
export function publicBuyAssistanceRouter(config: AuthConfig, repository: BuyAssistanceRepository, storage: MediaStorage) {
  const router = Router(); const service = new BuyAssistanceService(repository, storage); router.use((_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
  router.post("/", rateLimit({ windowMs: 3600000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false, message: { success: false, error: { code: "RATE_LIMITED", message: "Too many buying assistance requests. Please try again later." } } }), wrap(async (request, response) => {
    if (request.headers.origin !== config.webOrigin) throw new AuthError(403, "UNTRUSTED_ORIGIN", "This request is not permitted.");
    if (!request.is("multipart/form-data")) throw new AuthError(415, "MULTIPART_REQUIRED", "Submit the buying assistance request with multipart form data.");
    if (Object.keys(request.query).length) throw new AuthError(400, "INVALID_BUY_ASSISTANCE", "Check the supplied buying assistance fields.");
    const upload = await readBuyAssistance(request); await service.submit(buyAssistanceInput.parse(upload.data), upload.mandate);
    response.status(201).json({ success: true, data: { recorded: true } });
  })); return router;
}
