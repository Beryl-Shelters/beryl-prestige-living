import { z } from "zod";

const origin = z.url().refine((value) => {
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && url.origin === value && !url.username && !url.password;
}, "Use an HTTP(S) origin without a trailing slash or path.");

export const authConfigSchema = z.object({
  webOrigin: origin,
  apiOrigin: origin,
  supabaseUrl: z.url(),
  anonKey: z.string().min(1),
  serviceKey: z.string().min(1),
  encryptionKey: z.string().regex(/^[A-Za-z0-9+/]{43}=$/, "AUTH_ENCRYPTION_KEY must be 32 random bytes encoded as base64."),
  cookieSecure: z.boolean(),
  cookieSameSite: z.enum(["lax", "strict", "none"]).default("lax"),
  sessionSeconds: z.coerce.number().int().min(300).max(604800).default(604800),
  rateWindowMs: z.coerce.number().int().min(1000).default(900000),
  rateLimit: z.coerce.number().int().min(1).default(30),
  googleEnabled: z.boolean().default(false),
  production: z.boolean(),
}).superRefine((value, ctx) => {
  if ((value.production || value.cookieSameSite === "none") && !value.cookieSecure) {
    ctx.addIssue({ code: "custom", message: "Secure cookies are required for production and SameSite=None." });
  }
  if (value.production && (!value.webOrigin.startsWith("https:") || !value.apiOrigin.startsWith("https:"))) {
    ctx.addIssue({ code: "custom", message: "Production Web and API origins must use HTTPS." });
  }
});
export type AuthConfig = z.infer<typeof authConfigSchema>;

// Missing secrets disable auth routes, while health, builds and type-check remain usable.
export function loadAuthConfig(source: NodeJS.ProcessEnv): AuthConfig | undefined {
  if (![source.SUPABASE_URL, source.SUPABASE_ANON_KEY, source.SUPABASE_SERVICE_ROLE_KEY, source.AUTH_ENCRYPTION_KEY, source.WEB_APP_URL, source.API_PUBLIC_URL].every(Boolean)) return undefined;
  const parsed = authConfigSchema.safeParse({
    webOrigin: source.WEB_APP_URL, apiOrigin: source.API_PUBLIC_URL,
    supabaseUrl: source.SUPABASE_URL, anonKey: source.SUPABASE_ANON_KEY,
    serviceKey: source.SUPABASE_SERVICE_ROLE_KEY, encryptionKey: source.AUTH_ENCRYPTION_KEY,
    production: source.NODE_ENV === "production",
    cookieSecure: source.AUTH_COOKIE_SECURE ? source.AUTH_COOKIE_SECURE === "true" : source.NODE_ENV === "production",
    cookieSameSite: source.AUTH_COOKIE_SAME_SITE || "lax",
    sessionSeconds: source.AUTH_SESSION_SECONDS || 604800,
    rateWindowMs: source.AUTH_RATE_WINDOW_MS || 900000,
    rateLimit: source.AUTH_RATE_LIMIT || 30,
    googleEnabled: source.AUTH_GOOGLE_ENABLED === "true",
  });
  if (!parsed.success) throw new Error("Invalid authentication configuration. Check the documented origins, cookie settings and encryption key.");
  return parsed.data;
}
