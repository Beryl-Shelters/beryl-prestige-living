/** Only allow an in-app path to be used after authentication. */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  try {
    const url = new URL(value, "https://customer.berylshelter.com");
    return url.origin === "https://customer.berylshelter.com" ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

export function loginHrefFor(returnTo: string) {
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}
