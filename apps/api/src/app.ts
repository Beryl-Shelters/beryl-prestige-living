import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import type { AuthConfig } from "./auth/config.js";
import { authErrorHandler, unavailable } from "./auth/errors.js";
import { SupabaseAuthGateway, type AuthGateway } from "./auth/gateway.js";
import { authRouter } from "./auth/routes.js";
import { dashboardRouter } from "./dashboard/routes.js";
import type { DashboardRepository } from "./dashboard/repository.js";

export interface AppConfig {
  webAppUrl: string | undefined;
  auth?: AuthConfig | undefined;
  gateway?: AuthGateway;
  dashboardRepository?: DashboardRepository;
  trustProxyHops?: number;
}

export function createApp(config: AppConfig): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxyHops ?? 0);
  app.use(helmet());
  app.use(cors({ origin: config.auth?.webOrigin ?? config.webAppUrl ?? false, credentials: true, methods: ["GET", "POST"], allowedHeaders: ["Content-Type"] }));
  app.use(express.json({ limit: "16kb" }));

  app.get("/health", (_request, response) => {
    response.status(200).json({
      success: true,
      service: "beryl-shelter-api",
    });
  });

  if (config.auth) {
    const gateway = config.gateway ?? new SupabaseAuthGateway(config.auth);
    app.use("/api/v1/auth", authRouter(config.auth, gateway));
    app.use("/api/v1/dashboard", dashboardRouter(config.auth, gateway, config.dashboardRepository));
  } else app.use(["/api/v1/auth", "/api/v1/dashboard"], (_request, _response, next) => next(unavailable()));
  app.use(authErrorHandler);
  return app;
}
