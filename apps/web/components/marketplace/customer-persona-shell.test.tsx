import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerSessionState } from "@/lib/contracts";

const mocks = vi.hoisted(() => ({
  pathname: "/marketplace",
  session: null as CustomerSessionState | null,
}));

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@/context/auth-provider", () => ({ useAuth: () => ({ session: mocks.session }) }));
vi.mock("./buyer-shell", () => ({ BuyerShell: ({ children }: { children: React.ReactNode }) => <section aria-label="Buyer shell">{children}</section> }));
vi.mock("./seller-shell", () => ({ SellerShell: ({ children }: { children: React.ReactNode }) => <section aria-label="Seller shell">{children}</section> }));

import { CustomerPersonaShell } from "./customer-persona-shell";

const buyerSession = {
  user: { id: "buyer", fullName: "Ada Buyer", email: "ada@example.com", phone: null, accountStatus: "ACTIVE", emailVerified: true },
  activePersona: "BUYER",
  personas: [{ type: "BUYER", onboardingStatus: "COMPLETED" }],
  nextAction: "OPEN_BUYER_DASHBOARD",
} as CustomerSessionState;

const sellerSession = {
  ...buyerSession,
  activePersona: "SELLER_DEVELOPER",
  personas: [{ type: "SELLER_DEVELOPER", onboardingStatus: "COMPLETED" }],
  nextAction: "OPEN_SELLER_DASHBOARD",
} as CustomerSessionState;

describe("shared Marketplace persona shell", () => {
  beforeEach(() => {
    mocks.pathname = "/marketplace";
    mocks.session = buyerSession;
  });

  it("renders Buyer Marketplace content once inside BuyerShell", () => {
    render(<CustomerPersonaShell><main>Marketplace content</main></CustomerPersonaShell>);
    expect(screen.getByRole("region", { name: "Buyer shell" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Seller shell" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Marketplace content")).toHaveLength(1);
  });

  it("renders Seller Marketplace and detail content once inside SellerShell", () => {
    mocks.session = sellerSession;
    const view = render(<CustomerPersonaShell><main>Marketplace content</main></CustomerPersonaShell>);
    expect(screen.getByRole("region", { name: "Seller shell" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Buyer shell" })).not.toBeInTheDocument();

    mocks.pathname = "/marketplace/property-id";
    view.rerender(<CustomerPersonaShell><main>Marketplace content</main></CustomerPersonaShell>);
    expect(screen.getByRole("region", { name: "Seller shell" })).toBeInTheDocument();
    expect(screen.getAllByText("Marketplace content")).toHaveLength(1);
  });

  it("switches Seller to Buyer shell immediately from refreshed session state", () => {
    mocks.session = sellerSession;
    const view = render(<CustomerPersonaShell><main>Marketplace content</main></CustomerPersonaShell>);
    expect(screen.getByRole("region", { name: "Seller shell" })).toBeInTheDocument();

    mocks.session = buyerSession;
    view.rerender(<CustomerPersonaShell><main>Marketplace content</main></CustomerPersonaShell>);
    expect(screen.getByRole("region", { name: "Buyer shell" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Seller shell" })).not.toBeInTheDocument();
  });

  it("switches Buyer to Seller shell immediately from refreshed session state", () => {
    const view = render(<CustomerPersonaShell><main>Marketplace content</main></CustomerPersonaShell>);
    expect(screen.getByRole("region", { name: "Buyer shell" })).toBeInTheDocument();

    mocks.session = sellerSession;
    view.rerender(<CustomerPersonaShell><main>Marketplace content</main></CustomerPersonaShell>);
    expect(screen.getByRole("region", { name: "Seller shell" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Buyer shell" })).not.toBeInTheDocument();
  });
});
