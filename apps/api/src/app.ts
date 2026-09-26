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
import { referralsRouter } from "./referrals/routes.js";
import { SupabaseReferralsRepository, type ReferralsRepository } from "./referrals/repository.js";
import { settingsRouter } from "./settings/routes.js";
import { SupabaseSettingsRepository,type SettingsRepository } from "./settings/repository.js";
import { kycRouter } from "./kyc/routes.js";
import { SupabaseKycRepository,type KycRepository } from "./kyc/repository.js";
import { publicAnalyticsRouter } from "./public-analytics/routes.js";
import { SupabasePublicAnalyticsRepository, type PublicAnalyticsRepository } from "./public-analytics/repository.js";
import { publicSupportRouter } from "./public-support/routes.js";
import { SupabasePublicSupportRepository, type PublicSupportRepository } from "./public-support/repository.js";
import { publicCareersRouter } from "./public-careers/routes.js";
import { SupabaseCareerApplicationsRepository, type CareerApplicationsRepository } from "./public-careers/repository.js";
import { publicPropertiesRouter } from "./public-properties/routes.js";
import { SupabasePublicPropertiesRepository, type PublicPropertiesRepository } from "./public-properties/repository.js";
import { savedPropertiesRouter } from "./saved-properties/routes.js";
import { SupabaseSavedPropertiesRepository, type SavedPropertiesRepository } from "./saved-properties/repository.js";
import { publicInquiriesRouter } from "./public-inquiries/routes.js";
import { SupabasePublicInquiriesRepository, type PublicInquiriesRepository } from "./public-inquiries/repository.js";
import { publicSellAssistanceRouter } from "./public-sell-assistance/routes.js";
import { SupabaseSellAssistanceRepository, type SellAssistanceRepository } from "./public-sell-assistance/repository.js";
import { publicBuyAssistanceRouter } from "./public-buy-assistance/routes.js";
import { SupabaseBuyAssistanceRepository, type BuyAssistanceRepository } from "./public-buy-assistance/repository.js";

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
  referralsRepository?: ReferralsRepository;
  settingsRepository?: SettingsRepository;
  kycRepository?: KycRepository;
  publicAnalyticsRepository?: PublicAnalyticsRepository;
  publicSupportRepository?: PublicSupportRepository;
  careerApplicationsRepository?: CareerApplicationsRepository;
  publicPropertiesRepository?: PublicPropertiesRepository;
  savedPropertiesRepository?: SavedPropertiesRepository;
  publicInquiriesRepository?: PublicInquiriesRepository;
  sellAssistanceRepository?: SellAssistanceRepository;
  buyAssistanceRepository?: BuyAssistanceRepository;
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
    const storage = config.mediaStorage ?? new CloudinaryStorage();
    app.use("/api/v1/public", publicAnalyticsRouter(config.auth, config.publicAnalyticsRepository ?? new SupabasePublicAnalyticsRepository(config.auth)));
    app.use("/api/v1/public/support", publicSupportRouter(config.auth, config.publicSupportRepository ?? new SupabasePublicSupportRepository(config.auth)));
    app.use("/api/v1/public/careers", publicCareersRouter(config.auth, config.careerApplicationsRepository ?? new SupabaseCareerApplicationsRepository(config.auth), storage));
    app.use("/api/v1/public/properties", publicPropertiesRouter(config.publicPropertiesRepository ?? new SupabasePublicPropertiesRepository(config.auth)));
    app.use("/api/v1/public/inquiries", publicInquiriesRouter(config.auth,config.publicInquiriesRepository??new SupabasePublicInquiriesRepository(config.auth)));
    app.use("/api/v1/public/sell-assistance", publicSellAssistanceRouter(config.auth, config.sellAssistanceRepository ?? new SupabaseSellAssistanceRepository(config.auth), storage));
    app.use("/api/v1/public/buy-assistance", publicBuyAssistanceRouter(config.auth, config.buyAssistanceRepository ?? new SupabaseBuyAssistanceRepository(config.auth), storage));
    const gateway = config.gateway ?? new SupabaseAuthGateway(config.auth);
    const listings = config.listingsRepository ?? new SupabaseListingsRepository(config.auth);
    const tickets = config.ticketsRepository ?? new SupabaseTicketsRepository(config.auth);
    app.use("/api/v1/auth", authRouter(config.auth, gateway));
    app.use("/api/v1/dashboard", dashboardRouter(config.auth, gateway, config.dashboardRepository ?? new MessagesDashboardRepository(tickets,owner=>listings.recent(owner))));
    app.use("/api/v1/dashboard/analytics", analyticsRouter(config.auth, gateway, config.analyticsRepository ?? new SupabaseAnalyticsRepository(config.auth), config.categoryPerformanceRepository));
    app.use("/api/v1/dashboard/properties", purchasedPropertiesRouter(config.auth, gateway, config.purchasedPropertiesRepository));
    app.use("/api/v1/dashboard/referrals", referralsRouter(config.auth,gateway,config.referralsRepository??new SupabaseReferralsRepository(config.auth)));
    app.use("/api/v1/saved-properties", savedPropertiesRouter(config.auth, gateway, config.savedPropertiesRepository ?? new SupabaseSavedPropertiesRepository(config.auth)));
    app.use("/api/v1/dashboard/settings", settingsRouter(config.auth,gateway,config.settingsRepository??new SupabaseSettingsRepository(config.auth),storage));
    app.use("/api/v1/dashboard/kyc",kycRouter(config.auth,gateway,config.kycRepository??new SupabaseKycRepository(config.auth),storage));
    app.use("/api/v1/listings", listingsRouter(config.auth, gateway, listings, storage));
    app.use("/api/v1/messages", messagesRouter(config.auth,gateway,tickets,storage));
  } else app.use(["/api/v1/auth", "/api/v1/dashboard", "/api/v1/listings", "/api/v1/messages"], (_request, _response, next) => next(unavailable()));
  app.use(authErrorHandler);
  return app;
}
