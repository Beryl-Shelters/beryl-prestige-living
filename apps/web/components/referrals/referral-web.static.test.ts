import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const route = readFileSync(join(root, "app/api/referrals/[...path]/route.ts"), "utf8");
const styles = readFileSync(join(root, "app/referrals.css"), "utf8");
const direct = readFileSync(join(root, "components/referrals/direct-referral-screen.tsx"), "utf8");
const dashboard = readFileSync(join(root, "components/referrals/referral-dashboard-screen.tsx"), "utf8");

describe("referral Web architecture", () => {
  it("ships the approved app-owned referral imagery", () => {
    for (const name of ["referral-hero-collage.png", "referral-form-portrait.png", "referral-success.png"]) {
      expect(existsSync(join(root, "public/images/referrals", name))).toBe(true);
    }
  });
  it("keeps landing, link and direct routes public", () => {
    for (const path of ["app/refer/page.tsx", "app/refer/direct/page.tsx", "app/r/[code]/page.tsx"]) expect(existsSync(join(root, path))).toBe(true);
    expect(direct).not.toContain('redirect("/login")');
  });
  it("stores the narrow tracking token only in an HttpOnly cookie", () => {
    expect(route).toContain("REFERRAL_TRACKING_COOKIE");
    expect(route).toContain("httpOnly: true");
    expect(route).toContain("trackingToken");
    expect(route).toContain("data: { expiresIn }");
    expect(route).not.toContain("localStorage");
  });
  it("forwards customer access and referral-only authorization independently", () => {
    expect(route).toContain("authorization: `Bearer ${access}`");
    expect(route).toContain('"x-referral-tracking-token": tracking');
  });
  it("supports desktop and usable narrow-width layouts", () => {
    expect(styles).toContain("grid-template-columns:minmax(360px,44%) 1fr");
    expect(styles).toContain("@media(max-width:900px)");
    expect(styles).toContain("@media(max-width:640px)");
  });
  it("renders loading, error, pagination, empty, bank and masked payout states", () => {
    for (const text of ["Loading your referrals", "Track your referrals", "referral-pagination", "No referrals yet", "Add your bank details", "maskedAccountNumber"]) expect(dashboard).toContain(text);
  });
  it("does not add referral analytics or PII tracking", () => {
    const files = [direct, dashboard, route].join("\n");
    expect(files).not.toContain("trackCustomerEvent");
    expect(files).not.toContain("mixpanel");
  });
});
