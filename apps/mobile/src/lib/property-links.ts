import { webBaseUrl } from "./config";

const propertyCodePattern = /^[A-Za-z0-9-]{1,80}$/;
export function isValidPropertyCode(value: string) { return propertyCodePattern.test(value); }
export function canonicalPropertyUrl(code: string, referralCode?: string) {
  if (!isValidPropertyCode(code)) throw new Error("Invalid property code.");
  const url = new URL(`/buy/${encodeURIComponent(code)}`, webBaseUrl);
  if (referralCode?.trim()) url.searchParams.set("ref", referralCode.trim());
  return url.toString();
}

export function mobilePathFromIncoming(path: string) {
  try {
    const url = new URL(path, "berylshelter://app");
    const referral = url.searchParams.get("ref")?.trim();
    const direct = url.pathname.match(/^\/buy\/([A-Za-z0-9-]{1,80})\/?$/i);
    const queryCode = url.pathname === "/buy" ? url.searchParams.get("code")?.trim() : undefined;
    const code = direct?.[1] ?? queryCode;
    if (code && isValidPropertyCode(code)) return `/properties/${encodeURIComponent(code)}${referral ? `?ref=${encodeURIComponent(referral)}` : ""}`;
    if (url.pathname === "/buy") { const q = url.searchParams.get("q")?.trim(); return `/properties${q ? `?q=${encodeURIComponent(q)}` : ""}`; }
    return `${url.pathname}${url.search}` || "/";
  } catch { return "/"; }
}
