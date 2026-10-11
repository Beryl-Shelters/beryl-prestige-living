import type { RequestHandler } from "express";
import swaggerUi from "swagger-ui-express";

type HttpMethod = "get" | "post" | "patch" | "delete";

interface DocumentedEndpoint {
  method: HttpMethod;
  path: string;
  summary: string;
  tag: string;
  public?: boolean;
  multipart?: boolean;
}

const endpoints: DocumentedEndpoint[] = [
  { method: "get", path: "/health", summary: "Check API health", tag: "System", public: true },
  { method: "post", path: "/api/v1/auth/register", summary: "Register a customer", tag: "Authentication", public: true },
  { method: "post", path: "/api/v1/auth/login", summary: "Sign in a customer", tag: "Authentication", public: true },
  { method: "get", path: "/api/v1/auth/verification-context", summary: "Read email verification context", tag: "Authentication", public: true },
  { method: "post", path: "/api/v1/auth/verify-email", summary: "Verify a customer email", tag: "Authentication", public: true },
  { method: "post", path: "/api/v1/auth/resend-verification", summary: "Resend an email verification code", tag: "Authentication", public: true },
  { method: "get", path: "/api/v1/auth/me", summary: "Read the signed-in customer", tag: "Authentication" },
  { method: "post", path: "/api/v1/auth/logout", summary: "Sign out a customer", tag: "Authentication" },
  { method: "post", path: "/api/v1/auth/forgot-password", summary: "Start password recovery", tag: "Authentication", public: true },
  { method: "post", path: "/api/v1/auth/resend-recovery", summary: "Resend a recovery code", tag: "Authentication", public: true },
  { method: "post", path: "/api/v1/auth/verify-recovery", summary: "Verify a recovery code", tag: "Authentication", public: true },
  { method: "get", path: "/api/v1/auth/recovery-context", summary: "Read password recovery context", tag: "Authentication", public: true },
  { method: "post", path: "/api/v1/auth/reset-password", summary: "Reset a customer password", tag: "Authentication", public: true },
  { method: "post", path: "/api/v1/auth/google", summary: "Start Google authentication", tag: "Authentication", public: true },
  { method: "post", path: "/api/v1/auth/google/callback", summary: "Complete Google authentication", tag: "Authentication", public: true },
  { method: "get", path: "/api/v1/public/analytics", summary: "Read public property analytics", tag: "Public", public: true },
  { method: "post", path: "/api/v1/public/property-searches", summary: "Record a public property search", tag: "Public", public: true },
  { method: "get", path: "/api/v1/public/properties", summary: "Search listed properties", tag: "Public", public: true },
  { method: "get", path: "/api/v1/public/properties/{code}", summary: "Read a listed property", tag: "Public", public: true },
  { method: "post", path: "/api/v1/public/support/reports", summary: "Submit a support report", tag: "Public", public: true, multipart: true },
  { method: "post", path: "/api/v1/public/careers/applications", summary: "Submit a career application", tag: "Public", public: true, multipart: true },
  { method: "post", path: "/api/v1/public/inquiries", summary: "Submit a property inquiry", tag: "Public", public: true },
  { method: "post", path: "/api/v1/public/sell-assistance", summary: "Request selling assistance", tag: "Public", public: true, multipart: true },
  { method: "post", path: "/api/v1/public/buy-assistance", summary: "Request buying assistance", tag: "Public", public: true, multipart: true },
  { method: "post", path: "/api/v1/public/property-viewings", summary: "Schedule a property viewing", tag: "Public", public: true },
  { method: "get", path: "/api/v1/dashboard/overview", summary: "Read dashboard overview", tag: "Dashboard" },
  { method: "get", path: "/api/v1/dashboard/analytics", summary: "Read customer analytics", tag: "Dashboard" },
  { method: "get", path: "/api/v1/dashboard/properties", summary: "Read purchased properties", tag: "Dashboard" },
  { method: "get", path: "/api/v1/dashboard/referrals", summary: "Read customer referrals", tag: "Referrals" },
  { method: "post", path: "/api/v1/dashboard/referrals", summary: "Create a referral", tag: "Referrals" },
  { method: "post", path: "/api/v1/dashboard/referrals/public-property", summary: "Create a public-property referral", tag: "Referrals" },
  { method: "get", path: "/api/v1/dashboard/settings/profile", summary: "Read customer profile settings", tag: "Settings" },
  { method: "patch", path: "/api/v1/dashboard/settings/profile", summary: "Update customer profile settings", tag: "Settings" },
  { method: "get", path: "/api/v1/dashboard/settings/business", summary: "Read business settings", tag: "Settings" },
  { method: "patch", path: "/api/v1/dashboard/settings/business", summary: "Update business settings", tag: "Settings" },
  { method: "patch", path: "/api/v1/dashboard/settings/password", summary: "Change customer password", tag: "Settings" },
  { method: "get", path: "/api/v1/dashboard/kyc", summary: "Read KYC status", tag: "KYC" },
  { method: "post", path: "/api/v1/dashboard/kyc", summary: "Submit KYC documents", tag: "KYC", multipart: true },
  { method: "get", path: "/api/v1/dashboard/kyc/documents/{documentId}", summary: "Download a KYC document", tag: "KYC" },
  { method: "get", path: "/api/v1/saved-properties", summary: "Read saved properties", tag: "Saved Properties" },
  { method: "get", path: "/api/v1/saved-properties/states", summary: "Read saved-property states", tag: "Saved Properties" },
  { method: "get", path: "/api/v1/saved-properties/compare", summary: "Read properties selected for comparison", tag: "Saved Properties" },
  { method: "post", path: "/api/v1/saved-properties", summary: "Save a property", tag: "Saved Properties" },
  { method: "delete", path: "/api/v1/saved-properties/{propertyCode}", summary: "Remove a saved property", tag: "Saved Properties" },
  { method: "get", path: "/api/v1/listings/options", summary: "Read listing form options", tag: "Listings" },
  { method: "get", path: "/api/v1/listings", summary: "Read customer listings", tag: "Listings" },
  { method: "post", path: "/api/v1/listings", summary: "Create a listing", tag: "Listings", multipart: true },
  { method: "get", path: "/api/v1/listings/{id}", summary: "Read a customer listing", tag: "Listings" },
  { method: "patch", path: "/api/v1/listings/{id}", summary: "Update a customer listing", tag: "Listings", multipart: true },
  { method: "delete", path: "/api/v1/listings/{id}", summary: "Delete a listing", tag: "Listings" },
  { method: "post", path: "/api/v1/listings/{id}/request-approval", summary: "Request listing approval", tag: "Listings" },
  { method: "post", path: "/api/v1/listings/{id}/unlist", summary: "Unlist a property", tag: "Listings" },
  { method: "post", path: "/api/v1/listings/{id}/documents", summary: "Upload listing documents", tag: "Listings", multipart: true },
  { method: "post", path: "/api/v1/listings/{id}/mandate/documents", summary: "Upload mandate documents", tag: "Listings", multipart: true },
  { method: "post", path: "/api/v1/listings/{id}/mandate/signature", summary: "Upload mandate signature", tag: "Listings", multipart: true },
  { method: "post", path: "/api/v1/listings/{id}/mandates", summary: "Save mandate data", tag: "Listings" },
  { method: "get", path: "/api/v1/listings/{id}/mandate", summary: "Read listing mandate", tag: "Listings" },
  { method: "post", path: "/api/v1/listings/{id}/submit", summary: "Submit a listing", tag: "Listings" },
  { method: "get", path: "/api/v1/messages/tickets", summary: "Read support tickets", tag: "Messages" },
  { method: "post", path: "/api/v1/messages/tickets", summary: "Create a support ticket", tag: "Messages", multipart: true },
  { method: "get", path: "/api/v1/messages/tickets/{ticketId}", summary: "Read a support ticket", tag: "Messages" },
  { method: "post", path: "/api/v1/messages/tickets/{ticketId}/messages", summary: "Reply to a support ticket", tag: "Messages", multipart: true },
  { method: "post", path: "/api/v1/messages/tickets/{ticketId}/read", summary: "Mark a support ticket as read", tag: "Messages" },
];

function parameters(path: string) {
  return [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
}

function operation(endpoint: DocumentedEndpoint) {
  const body = endpoint.method === "post" || endpoint.method === "patch" || endpoint.method === "delete";
  return {
    tags: [endpoint.tag],
    summary: endpoint.summary,
    ...(endpoint.public ? {} : { security: [{ customerSession: [] }] }),
    ...(parameters(endpoint.path).length ? { parameters: parameters(endpoint.path) } : {}),
    ...(body ? {
      requestBody: {
        required: endpoint.method !== "delete",
        content: endpoint.multipart
          ? { "multipart/form-data": { schema: { type: "object", additionalProperties: true } } }
          : { "application/json": { schema: { type: "object", additionalProperties: true } } },
      },
    } : {}),
    responses: {
      "200": { description: "Successful response" },
      ...(endpoint.method === "post" ? { "201": { description: "Resource created" } } : {}),
      "400": { description: "Invalid request" },
      ...(endpoint.public ? {} : { "401": { description: "Authentication required" } }),
    },
  };
}

export function createOpenApiDocument(serverUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const endpoint of endpoints) {
    (paths[endpoint.path] ??= {})[endpoint.method] = operation(endpoint);
  }
  return {
    openapi: "3.0.3",
    info: {
      title: "Beryl Shelter API",
      version: "2.0.0",
      description: "Development API reference. Authenticated requests use the Beryl Shelter session cookie.",
    },
    servers: [{ url: serverUrl, description: "Current development API" }],
    tags: [...new Set(endpoints.map(({ tag }) => tag))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        customerSession: { type: "apiKey", in: "cookie", name: "beryl_customer_access" },
      },
    },
  };
}

export const swaggerAssets: RequestHandler[] = swaggerUi.serve;
export const swaggerPage = swaggerUi.setup(undefined, {
  customSiteTitle: "Beryl Shelter API Docs",
  swaggerOptions: {
    url: "/api-docs/openapi.json",
    persistAuthorization: true,
    requestInterceptor: (request: Record<string, unknown>) => {
      request.credentials = "include";
      return request;
    },
  },
});
