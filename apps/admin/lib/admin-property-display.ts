import type { AdminPropertyStatus } from "@/lib/contracts";

export const propertyStatus = {
  IN_REVIEW: { label: "Pending Review", tone: "pending" },
  LIVE: { label: "Approved", tone: "approved" },
  REJECTED: { label: "Rejected", tone: "rejected" }
} satisfies Record<AdminPropertyStatus, { label: string; tone: string }>;

export const propertyTabs = [
  ["ALL", "All", "all"],
  ["IN_REVIEW", "Pending Review", "inReview"],
  ["LIVE", "Approved", "live"],
  ["REJECTED", "Rejected", "rejected"]
] as const;

export const propertySortOptions = [
  ["OPERATIONAL", "Operational priority"],
  ["MOST_RECENT", "Most recent"],
  ["OLDEST", "Oldest"],
  ["PRICE_HIGH", "Price high to low"],
  ["PRICE_LOW", "Price low to high"]
] as const;

export const rejectionReasonPresets = ["Poor photo quality", "More photos needed", "Missing Documents", "Unrealistic Pricing", "Incomplete Details", "Other"] as const;

export const humanizePropertyValue = (value?: string | null) => value?.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()) || "Not available";
export const formatPropertyMoney = (value?: number | null) => value == null ? "Not available" : new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);
export const formatPropertyDate = (value?: string | null) => value ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not available";
export const formatPropertyFileSize = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.ceil(value / 1_000))} KB`;
export const formatInitialDeposit = (type?: "AMOUNT" | "PERCENTAGE" | null, value?: number | null) => {
  if (!type || value == null) return "None";
  return type === "PERCENTAGE" ? `${value}%` : formatPropertyMoney(value);
};
