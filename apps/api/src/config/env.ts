const NODE_ENVIRONMENTS = ["development", "test", "production"] as const;

type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

export interface ApiEnvironment {
  nodeEnv: NodeEnvironment;
  port: number;
  webAppUrl: string | undefined;
  supabaseUrl: string | undefined;
  supabaseServiceRoleKey: string | undefined;
}

function optionalValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function optionalHttpUrl(value: string | undefined, name: string): string | undefined {
  const normalized = optionalValue(value);
  if (!normalized) return undefined;

  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${name} must be a valid HTTP(S) URL`);
  }
}

function parsePort(value: string | undefined): number {
  const normalized = optionalValue(value);
  if (!normalized) return 4000;

  const port = Number(normalized);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}

function parseNodeEnvironment(value: string | undefined): NodeEnvironment {
  const normalized = optionalValue(value) ?? "development";
  if (!NODE_ENVIRONMENTS.includes(normalized as NodeEnvironment)) {
    throw new Error(`NODE_ENV must be one of: ${NODE_ENVIRONMENTS.join(", ")}`);
  }
  return normalized as NodeEnvironment;
}

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): ApiEnvironment {
  return {
    nodeEnv: parseNodeEnvironment(source.NODE_ENV),
    port: parsePort(source.PORT),
    webAppUrl: optionalHttpUrl(source.WEB_APP_URL, "WEB_APP_URL"),
    supabaseUrl: optionalHttpUrl(source.SUPABASE_URL, "SUPABASE_URL"),
    supabaseServiceRoleKey: optionalValue(source.SUPABASE_SERVICE_ROLE_KEY),
  };
}
