const API_PREFIX = "/api/v1";

export class ApiConfigurationError extends Error {
  constructor() {
    super("API_BASE_URL is not configured. Set it to the backend origin with or without /api/v1.");
    this.name = "ApiConfigurationError";
  }
}

export function normalizedApiBase(configuredBase = process.env.API_BASE_URL) {
  const value = configuredBase?.trim();
  if (!value) throw new ApiConfigurationError();

  const withoutTrailingSlash = value.replace(/\/+$/, "");
  const withoutApiPrefix = withoutTrailingSlash.replace(/(?:\/api\/v1)+$/i, "");
  return `${withoutApiPrefix}${API_PREFIX}`;
}

export function backendApiUrl(endpoint: string, configuredBase = process.env.API_BASE_URL) {
  return `${normalizedApiBase(configuredBase)}/${endpoint.replace(/^\/+/, "")}`;
}
