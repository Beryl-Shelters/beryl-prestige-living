import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import type { AuthConfig } from "./auth/config.js";
import { authErrorHandler, unavailable } from "./auth/errors.js";
import { SupabaseAuthGateway, type AuthGateway } from "./auth/gateway.js";
import { authRouter } from "./auth/routes.js";
import { dashboardRouter } from "./dashboard/routes.js";
import type { DashboardRepository } from "./dashboard/repository.js";
import { listingsRouter } from "./listings/routes.js";
import { SupabaseListingsRepository, type ListingsRepository } from "./listings/repository.js";
import { CloudinaryStorage, type MediaStorage } from "./listings/media.js";
import { ListingsDashboardRepository } from "./listings/dashboard-repository.js";
import { analyticsRouter } from "./dashboard/analytics-routes.js";
import { SupabaseAnalyticsRepository, type AnalyticsRepository, type CategoryPerformanceRepository } from "./dashboard/analytics-repository.js";

export interface AppConfig {
  webAppUrl: string | undefined;
  auth?: AuthConfig | undefined;
  gateway?: AuthGateway;
  dashboardRepository?: DashboardRepository;
  analyticsRepository?: AnalyticsRepository;
  categoryPerformanceRepository?: CategoryPerformanceRepository;
  listingsRepository?: ListingsRepository;
  mediaStorage?: MediaStorage;
  trustProxyHops?: number;
}

export function createApp(config: AppConfig): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxyHops ?? 0);
  app.use(helmet());
  app.use(cors({ origin: config.auth?.webOrigin ?? config.webAppUrl ?? false, credentials: true, methods: ["GET", "POST", "PATCH", "DELETE"], allowedHeaders: ["Content-Type"] }));
  app.use(express.json({ limit: "16kb" }));

  app.get("/health", (_request, response) => {
    response.status(200).json({
      success: true,
      service: "beryl-shelter-api",
    });
  });

  if (config.auth) {
    const gateway = config.gateway ?? new SupabaseAuthGateway(config.auth);
    const listings = config.listingsRepository ?? new SupabaseListingsRepository(config.auth);
    app.use("/api/v1/auth", authRouter(config.auth, gateway));
    app.use("/api/v1/dashboard", dashboardRouter(config.auth, gateway, config.dashboardRepository ?? new ListingsDashboardRepository(listings)));
    app.use("/api/v1/dashboard/analytics", analyticsRouter(config.auth, gateway, config.analyticsRepository ?? new SupabaseAnalyticsRepository(config.auth), config.categoryPerformanceRepository));
    app.use("/api/v1/listings", listingsRouter(config.auth, gateway, listings, config.mediaStorage ?? new CloudinaryStorage()));
  } else app.use(["/api/v1/auth", "/api/v1/dashboard", "/api/v1/listings"], (_request, _response, next) => next(unavailable()));
  app.use(authErrorHandler);
  return app;
}
