import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerSessionState } from "@/lib/contracts";

const mocks = vi.hoisted(() => ({
  pathname: "/marketplace",
  replace: vi.fn(),
  auth: { session: null as CustomerSessionState | null, sessionLoading: true },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/context/auth-provider", () => ({ useAuth: () => mocks.auth }));

import { CustomerRouteGate } from "./customer-route-gate";

const buyerSession: CustomerSessionState = {
  user: { id: "buyer", fullName: "Ada Buyer", email: "ada@example.com", phone: null, accountStatus: "ACTIVE", emailVerified: true },
  activePersona: "BUYER",
  personas: [{ type: "BUYER", onboardingStatus: "COMPLETED" }],
  nextAction: "OPEN_BUYER_DASHBOARD",
};

describe("CustomerRouteGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/marketplace?q=lekki");
    mocks.pathname = "/marketplace";
    mocks.auth.session = null;
    mocks.auth.sessionLoading = true;
  });

  it("does not flash protected content or redirect while session bootstrap is pending", () => {
    render(<CustomerRouteGate><p>Protected Marketplace</p></CustomerRouteGate>);
    expect(screen.getByText(/checking your account/i)).toBeVisible();
    expect(screen.queryByText("Protected Marketplace")).not.toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("redirects a confirmed anonymous session with its safe internal destination", async () => {
    mocks.auth.sessionLoading = false;
    render(<CustomerRouteGate><p>Protected Marketplace</p></CustomerRouteGate>);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login?returnTo=%2Fmarketplace%3Fq%3Dlekki"));
    expect(screen.queryByText("Protected Marketplace")).not.toBeInTheDocument();
  });

  it("renders Marketplace for a verified Buyer or Seller session", () => {
    mocks.auth.sessionLoading = false;
    mocks.auth.session = buyerSession;
    const view = render(<CustomerRouteGate><p>Protected Marketplace</p></CustomerRouteGate>);
    expect(screen.getByText("Protected Marketplace")).toBeVisible();
    mocks.auth.session = { ...buyerSession, activePersona: "SELLER_DEVELOPER", nextAction: "OPEN_SELLER_DASHBOARD" };
    view.rerender(<CustomerRouteGate><p>Protected Marketplace</p></CustomerRouteGate>);
    expect(screen.getByText("Protected Marketplace")).toBeVisible();
  });

  it("routes incomplete active personas to their onboarding without a protected-content flash", async () => {
    mocks.auth.sessionLoading = false;
    mocks.auth.session = { ...buyerSession, personas: [{ type: "BUYER", onboardingStatus: "NOT_STARTED" }], nextAction: "COMPLETE_BUYER_ONBOARDING" };
    render(<CustomerRouteGate><p>Protected Marketplace</p></CustomerRouteGate>);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/onboarding/buyer"));
    expect(screen.queryByText("Protected Marketplace")).not.toBeInTheDocument();
  });

  it("does not apply Customer authentication to referral acquisition routes", () => {
    mocks.pathname = "/refer/direct";
    mocks.auth.sessionLoading = false;
    render(<CustomerRouteGate><p>Guest referral flow</p></CustomerRouteGate>);
    expect(screen.getByText("Guest referral flow")).toBeVisible();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
