export function normalizeBaseUrl(value: string | undefined, fallback = "https://dev-api.berylshelter.com"): string {
  const candidate = value?.trim() || fallback;
  const url = new URL(candidate);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("EXPO_PUBLIC_API_BASE_URL must be an HTTP(S) origin.");
  return url.origin;
}

export const apiBaseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
export const webBaseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_WEB_BASE_URL, "https://dev.berylshelter.com");
export const mixpanelEnvironment = process.env.EXPO_PUBLIC_MIXPANEL_ENVIRONMENT === "production" ? "Production" : "Test";
