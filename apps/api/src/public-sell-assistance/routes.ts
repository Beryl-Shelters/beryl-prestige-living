import { Router, type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { AuthConfig } from "../auth/config.js";
import { AuthError } from "../auth/errors.js";
import type { MediaStorage } from "../listings/media.js";
import { sellAssistanceInput } from "./model.js";
import type { SellAssistanceRepository } from "./repository.js";
import { SellAssistanceService } from "./service.js";
import { readSellAssistance } from "./uploads.js";

const wrap = (fn: (request: Request, response: Response) => Promise<void>) => (request: Request, response: Response, next: NextFunction) => { void fn(request, response).catch(next); };
export function publicSellAssistanceRouter(config: AuthConfig, repository: SellAssistanceRepository, storage: MediaStorage) {
  const router = Router(); const service = new SellAssistanceService(repository, storage);
  router.use((_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
  router.post("/", rateLimit({ windowMs: 3600000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false,
    message: { success: false, error: { code: "RATE_LIMITED", message: "Too many assistance requests. Please try again later." } } }), wrap(async (request, response) => {
    if (request.headers.origin !== config.webOrigin) throw new AuthError(403, "UNTRUSTED_ORIGIN", "This request is not permitted.");
    if (!request.is("multipart/form-data")) throw new AuthError(415, "MULTIPART_REQUIRED", "Submit the assistance request with multipart form data.");
    if (Object.keys(request.query).length) throw new AuthError(400, "INVALID_SELL_ASSISTANCE", "Check the supplied assistance fields.");
    const upload = await readSellAssistance(request); const input = sellAssistanceInput.parse(upload.data);
    if (input.saleAuthorized === true && !upload.authorizationDocument) throw new AuthError(400, "AUTHORIZATION_DOCUMENT_REQUIRED", "Upload the authorization document for an authorized sale.");
    if (input.saleAuthorized !== true && upload.authorizationDocument) throw new AuthError(400, "UNEXPECTED_AUTHORIZATION_DOCUMENT", "Only upload an authorization document when the sale is authorized.");
    await service.submit(input, upload.images, upload.authorizationDocument);
    response.status(201).json({ success: true, data: { recorded: true } });
  }));
  return router;
}
