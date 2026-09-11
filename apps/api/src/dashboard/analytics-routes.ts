import { Router } from "express";
import type { AuthConfig } from "../auth/config.js";
import { AuthError, expired } from "../auth/errors.js";
import type { AuthGateway } from "../auth/gateway.js";
import { AuthSessions } from "../auth/sessions.js";
import { analyticsQuery } from "./analytics-model.js";
import type { AnalyticsRepository, CategoryPerformanceRepository } from "./analytics-repository.js";
import { AnalyticsService } from "./analytics-service.js";

export function analyticsRouter(config: AuthConfig, gateway: AuthGateway, repository: AnalyticsRepository, performance?: CategoryPerformanceRepository) {
  const router = Router();
  const sessions = new AuthSessions(config, gateway);
  const service = new AnalyticsService(repository, performance);
  router.get("/", (request, response, next) => {
    response.setHeader("Cache-Control", "no-store"); response.vary("Cookie");
    void (async () => {
      const tokens = await sessions.account(request);
      const customer = await gateway.findCustomer("id", tokens.userId);
      if (!customer?.email_verified_at) throw expired();
      const parsed = analyticsQuery.safeParse(request.query);
      if (!parsed.success || (request.body && Object.keys(request.body).length)) {
        throw new AuthError(400, "INVALID_ANALYTICS_QUERY", "Use a search of up to 100 characters and a year between 2000 and 2100.");
      }
      try {
        response.json({ success: true, data: await service.analytics(tokens.userId, parsed.data.q, parsed.data.year ?? new Date().getUTCFullYear()) });
      } catch {
        throw new AuthError(503, "ANALYTICS_UNAVAILABLE", "Analytics is temporarily unavailable. Please try again.");
      }
    })().catch(next);
  });
  return router;
}
