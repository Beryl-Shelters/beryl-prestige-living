import type { PublicProperty } from "./property-types";

export function toggleComparison(current: PublicProperty[], property: PublicProperty): { items: PublicProperty[]; outcome: "added" | "removed" | "limit" } {
  if (current.some(item => item.code === property.code)) return { items: current.filter(item => item.code !== property.code), outcome: "removed" };
  if (current.length >= 3) return { items: current, outcome: "limit" };
  return { items: [...current, property], outcome: "added" };
}
