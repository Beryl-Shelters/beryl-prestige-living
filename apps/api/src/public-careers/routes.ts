import { Router, type Request, type Response, type NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { AuthError } from "../auth/errors.js";
import type { AuthConfig } from "../auth/config.js";
import type { MediaStorage } from "../listings/media.js";
import { careerApplicationInput } from "./model.js";
import type { CareerApplicationsRepository } from "./repository.js";
import { CareerApplicationsService } from "./service.js";
import { readCareerApplication } from "./uploads.js";

const wrap = (fn: (request: Request, response: Response) => Promise<void>) => (request: Request, response: Response, next: NextFunction) => { void fn(request, response).catch(next); };
export function publicCareersRouter(config: AuthConfig, repository: CareerApplicationsRepository, storage: MediaStorage) {
  const router = Router(); const service = new CareerApplicationsService(repository, storage);
  router.use((_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
  router.post("/applications", rateLimit({ windowMs: 3600000, limit: 40, standardHeaders: "draft-7", legacyHeaders: false,
    message: { success: false, error: { code: "RATE_LIMITED", message: "Too many applications. Please try again later." } } }), wrap(async (request, response) => {
    if (request.headers.origin !== config.webOrigin) throw new AuthError(403, "UNTRUSTED_ORIGIN", "This request is not permitted.");
    if (!request.is("multipart/form-data")) throw new AuthError(415, "MULTIPART_REQUIRED", "Submit the application with a resume.");
    if (Object.keys(request.query).length) throw new AuthError(400, "INVALID_APPLICATION", "Check the supplied application fields.");
    const { data, file } = await readCareerApplication(request);
    const input = careerApplicationInput.parse(data);
    await service.submit(input, file);
    response.status(201).json({ success: true, data: { recorded: true } });
  }));
  return router;
}
