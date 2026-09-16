const fallback = "/account";

export function loginDestination(value: string | null | undefined): string {
  if (!value || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  let decoded: string;
  try { decoded = decodeURIComponent(value.split(/[?#]/,1)[0] ?? ""); } catch { return fallback; }
  if (decoded.startsWith("//") || decoded.includes("\\") || /[\u0000-\u001f\u007f]/.test(decoded)) return fallback;
  try {
    const base = new URL("https://internal.invalid");
    const destination = new URL(value,base);
    if (destination.origin !== base.origin || !["/account","/dashboard"].includes(destination.pathname) && !destination.pathname.startsWith("/dashboard/")) return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch { return fallback; }
}
