export function normalizeBaseUrl(value: string | undefined): string {
  const candidate = value?.trim() || "https://dev-api.berylshelter.com";
  const url = new URL(candidate);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("EXPO_PUBLIC_API_BASE_URL must be an HTTP(S) origin.");
  return url.origin;
}

export const apiBaseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
export const mixpanelEnvironment = process.env.EXPO_PUBLIC_MIXPANEL_ENVIRONMENT === "production" ? "Production" : "Test";
