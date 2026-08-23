export const formatAdminDate = (value: string | null, includeTime = false) => value
  ? new Intl.DateTimeFormat("en-NG", includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(value))
  : "—";

export const formatAdminCurrency = (value: number | null, currency = "NGN") => value == null
  ? "—"
  : new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

export const customerInitials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CU";
