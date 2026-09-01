import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("Buyer navigation architecture", () => {
  const shell = source("components/marketplace/buyer-shell.tsx");
  const personaShell = source("components/marketplace/customer-persona-shell.tsx");
  const providers = source("app/providers.tsx");
  const policy = source("lib/customer-route-policy.ts");
  const buyerOnboarding = source("components/onboarding/buyer-onboarding-screen.tsx");
  const styles = source("app/buyer-shell.css");

  it("wraps Customer-gated pages without turning navigation into authorization", () => {
    expect(providers).toContain("<CustomerRouteGate><CustomerPersonaShell>");
    expect(personaShell).toContain("return <SellerShell>{children}</SellerShell>");
    expect(personaShell).toContain("return <BuyerShell>{children}</BuyerShell>");
    expect(policy).toContain('"/marketplace"');
    expect(policy).toContain('"/saved"');
    expect(shell).toContain('session.nextAction === "OPEN_BUYER_DASHBOARD"');
  });

  it("keeps onboarding focused and preserves Nigeria-wide location completion", () => {
    expect(buyerOnboarding).not.toContain("BuyerShell");
    expect(buyerOnboarding).toContain("LocationSearch");
  });

  it("uses relative live routes and contains no Bug #10 placeholders", () => {
    for (const route of ['href: "/marketplace"', 'href: "/saved"', 'href: "/refer"']) {
      expect(shell).toContain(route);
    }
    expect(shell).not.toMatch(/https?:\/\//);
    expect(shell).not.toMatch(/Payments|Sub Accounts|Subaccounts|Save-as-you-earn|Invest|Support|Settings|Coming soon/i);
  });

  it("keeps desktop navigation persistent and tablet/mobile navigation off-canvas", () => {
    expect(styles).toContain(".buyer-app-main{min-width:0;min-height:100svh;margin-left:244px}");
    expect(styles).toContain("@media(max-width:1199px)");
    expect(styles).toContain(".buyer-sidebar{visibility:hidden;transform:translateX(-100%)");
    expect(styles).toContain(".buyer-sidebar.is-open{visibility:visible;transform:translateX(0)}");
  });
});
