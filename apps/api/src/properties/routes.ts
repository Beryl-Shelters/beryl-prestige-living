import { Router } from "express";
import type { AuthConfig } from "../auth/config.js";
import { AuthError, expired } from "../auth/errors.js";
import type { AuthGateway } from "../auth/gateway.js";
import { AuthSessions } from "../auth/sessions.js";
import { purchasedPropertiesQuery } from "./model.js";
import { EmptyPurchasedPropertiesRepository, type PurchasedPropertiesRepository } from "./repository.js";
import { PurchasedPropertiesService } from "./service.js";

export function purchasedPropertiesRouter(config: AuthConfig, gateway: AuthGateway, repository: PurchasedPropertiesRepository = new EmptyPurchasedPropertiesRepository()) {
  const router = Router();
  const sessions = new AuthSessions(config, gateway);
  const service = new PurchasedPropertiesService(repository);
  router.get("/", (request, response, next) => {
    response.setHeader("Cache-Control", "no-store"); response.vary("Cookie");
    void (async () => {
      const tokens = await sessions.account(request);
      const customer = await gateway.findCustomer("id", tokens.userId);
      if (!customer?.email_verified_at) throw expired();
      const parsed = purchasedPropertiesQuery.safeParse(request.query);
      if (!parsed.success || (request.body && Object.keys(request.body).length)) {
        throw new AuthError(400, "INVALID_PROPERTIES_QUERY", "Use a search of up to 100 characters and a positive whole-number page.");
      }
      try { response.json({ success: true, data: await service.list(tokens.userId, parsed.data.q, parsed.data.page) }); }
      catch { throw new AuthError(503, "PROPERTIES_UNAVAILABLE", "Purchased properties are temporarily unavailable. Please try again."); }
    })().catch(next);
  });
  return router;
}
