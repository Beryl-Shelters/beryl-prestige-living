import type { CorsOptions } from "cors";

export function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed || trimmed === "*") return null;

  try {
    const url = new URL(trimmed);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function parseAllowedOrigins(value?: string): string[] {
  return [...new Set((value ?? "").split(",").map(normalizeOrigin).filter((origin): origin is string => Boolean(origin)))];
}

export function createCorsOptions(allowedOrigins: readonly string[]): CorsOptions {
  const allowed = new Set(allowedOrigins.map(normalizeOrigin).filter((origin): origin is string => Boolean(origin)));
  return {
    origin(origin, callback) {
      if (!origin || allowed.has(normalizeOrigin(origin) ?? "")) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true
  };
}
