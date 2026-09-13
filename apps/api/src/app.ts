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
import { MessagesDashboardRepository } from "./messages/dashboard-repository.js";
import { analyticsRouter } from "./dashboard/analytics-routes.js";
import { SupabaseAnalyticsRepository, type AnalyticsRepository, type CategoryPerformanceRepository } from "./dashboard/analytics-repository.js";
import { messagesRouter } from "./messages/routes.js";
import { SupabaseTicketsRepository, type TicketsRepository } from "./messages/repository.js";
import { purchasedPropertiesRouter } from "./properties/routes.js";
import type { PurchasedPropertiesRepository } from "./properties/repository.js";

export interface AppConfig {
  webAppUrl: string | undefined;
  auth?: AuthConfig | undefined;
  gateway?: AuthGateway;
  dashboardRepository?: DashboardRepository;
  analyticsRepository?: AnalyticsRepository;
  categoryPerformanceRepository?: CategoryPerformanceRepository;
  ticketsRepository?: TicketsRepository;
  listingsRepository?: ListingsRepository;
  mediaStorage?: MediaStorage;
  purchasedPropertiesRepository?: PurchasedPropertiesRepository;
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
    const tickets = config.ticketsRepository ?? new SupabaseTicketsRepository(config.auth);
    const storage = config.mediaStorage ?? new CloudinaryStorage();
    app.use("/api/v1/auth", authRouter(config.auth, gateway));
    app.use("/api/v1/dashboard", dashboardRouter(config.auth, gateway, config.dashboardRepository ?? new MessagesDashboardRepository(tickets,owner=>listings.recent(owner))));
    app.use("/api/v1/dashboard/analytics", analyticsRouter(config.auth, gateway, config.analyticsRepository ?? new SupabaseAnalyticsRepository(config.auth), config.categoryPerformanceRepository));
    app.use("/api/v1/dashboard/properties", purchasedPropertiesRouter(config.auth, gateway, config.purchasedPropertiesRepository));
    app.use("/api/v1/listings", listingsRouter(config.auth, gateway, listings, storage));
    app.use("/api/v1/messages", messagesRouter(config.auth,gateway,tickets,storage));
  } else app.use(["/api/v1/auth", "/api/v1/dashboard", "/api/v1/listings", "/api/v1/messages"], (_request, _response, next) => next(unavailable()));
  app.use(authErrorHandler);
  return app;
}
