// @vitest-environment node
import { describe, expect, it } from "vitest";
import { loginHrefFor, safeReturnTo } from "./return-to";

describe("safe Marketplace return destinations", () => {
  it("preserves Marketplace and property-detail paths", () => {
    expect(safeReturnTo("/marketplace?q=lekki")).toBe("/marketplace?q=lekki");
    expect(safeReturnTo("/marketplace/property-id")).toBe("/marketplace/property-id");
    expect(loginHrefFor("/marketplace/property-id")).toBe("/login?returnTo=%2Fmarketplace%2Fproperty-id");
  });

  it("rejects external and protocol-relative destinations", () => {
    expect(safeReturnTo("https://example.com")).toBeNull();
    expect(safeReturnTo("//example.com")).toBeNull();
    expect(safeReturnTo("javascript:alert(1)")).toBeNull();
  });
});
