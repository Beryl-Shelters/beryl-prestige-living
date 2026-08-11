export type CustomerWebUrlConfig = {
  publicWebUrl?: string;
  customerAppUrl?: string;
};

const runtimeConfig: CustomerWebUrlConfig = {
  publicWebUrl: process.env.NEXT_PUBLIC_PUBLIC_WEB_URL,
  customerAppUrl: process.env.NEXT_PUBLIC_CUSTOMER_APP_URL
};

function normalizedBaseUrl(value?: string): string | null {
  const candidate = value?.trim().replace(/\/+$/, "");
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.origin;
  } catch {
    return null;
  }
}

function normalizedPath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function urlFor(base: string | null, path: string) {
  return base ? new URL(normalizedPath(path), `${base}/`).toString() : normalizedPath(path);
}

export function publicWebUrl(path = "/", config = runtimeConfig) {
  return urlFor(normalizedBaseUrl(config.publicWebUrl), path);
}

export function customerAppUrl(path: string, config = runtimeConfig) {
  return urlFor(normalizedBaseUrl(config.customerAppUrl), path);
}

export function isPublicWebHost(host: string | null, config = runtimeConfig) {
  const publicUrl = normalizedBaseUrl(config.publicWebUrl);
  return Boolean(host && publicUrl && host.toLowerCase() === new URL(publicUrl).host.toLowerCase());
}

export function customerRouteRedirectUrl(requestUrl: string, config = runtimeConfig) {
  const publicUrl = normalizedBaseUrl(config.publicWebUrl);
  const customerUrl = normalizedBaseUrl(config.customerAppUrl);
  if (!publicUrl || !customerUrl || publicUrl === customerUrl) return null;

  const request = new URL(requestUrl);
  if (request.origin !== publicUrl) return null;
  return new URL(`${request.pathname}${request.search}`, `${customerUrl}/`).toString();
}
