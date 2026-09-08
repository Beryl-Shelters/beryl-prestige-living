import { Router } from "express";
import type { AuthConfig } from "../auth/config.js";
import { AuthError, expired } from "../auth/errors.js";
import type { AuthGateway } from "../auth/gateway.js";
import { AuthSessions } from "../auth/sessions.js";
import { EmptyDashboardRepository, type DashboardRepository } from "./repository.js";
import { DashboardService } from "./service.js";

export function dashboardRouter(config: AuthConfig, gateway: AuthGateway, repository: DashboardRepository = new EmptyDashboardRepository()) {
  const router = Router();
  const sessions = new AuthSessions(config, gateway);
  const service = new DashboardService(repository);
  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store"); response.vary("Cookie"); next();
  });
  router.get("/overview", (request, response, next) => {
    void (async () => {
      const tokens = await sessions.account(request);
      const customer = await gateway.findCustomer("id", tokens.userId);
      if (!customer?.email_verified_at) throw expired();
      // No customer selector (or other query option) exists in Phase 1.
      if (Object.keys(request.query).length || (request.body && Object.keys(request.body).length)) {
        throw new AuthError(400, "INVALID_DASHBOARD_QUERY", "This overview does not accept customer identifiers or filters.");
      }
      try { response.json({ success: true, data: await service.overview(customer) }); }
      catch { throw new AuthError(503, "DASHBOARD_UNAVAILABLE", "Dashboard is temporarily unavailable. Please try again."); }
    })().catch(next);
  });
  return router;
}
