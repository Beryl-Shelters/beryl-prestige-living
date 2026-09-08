export function customerName(customer: { first_name: string | null; last_name: string | null }) {
  return [customer.first_name?.trim(), customer.last_name?.trim()].filter(Boolean).join(" ");
}
export function customerInitials(customer: { first_name: string | null; last_name: string | null }) {
  return [customer.first_name, customer.last_name].map((name) => Array.from(name?.trim() ?? "")[0] ?? "").join("").toLocaleUpperCase() || "—";
}
export function accountTypeLabel(value: string | null) {
  return (value ?? "").toLowerCase().split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
export function greeting(date = new Date()) {
  const hour = date.getHours();
  return hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
}
export function naira(value: number, fractionDigits = 2) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(value);
}
export function units(value: number) { return `${value.toLocaleString("en-NG")} ${value === 1 ? "Unit" : "Units"}`; }
export function messageCount(value: number) { return `${value.toLocaleString("en-NG")} ${value === 1 ? "message" : "messages"}`; }
