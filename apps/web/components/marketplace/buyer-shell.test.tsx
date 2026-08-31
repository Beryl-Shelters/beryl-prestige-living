import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerSessionState } from "@/lib/contracts";
import { BuyerShell } from "./buyer-shell";

const mocks = vi.hoisted(() => ({
  pathname: "/marketplace",
  replace: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  session: null as CustomerSessionState | null,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("@/context/auth-provider", () => ({
  useAuth: () => ({
    session: mocks.session,
    logout: mocks.logout,
    logoutPending: false,
  }),
}));

const buyerSession = {
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "Victor Beryl",
    email: "victor@example.com",
  },
  activePersona: "BUYER",
  personas: [{ type: "BUYER", onboardingStatus: "COMPLETED" }],
  nextAction: "OPEN_BUYER_DASHBOARD",
} as CustomerSessionState;

describe("BuyerShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = "/marketplace";
    mocks.session = buyerSession;
    mocks.logout.mockResolvedValue(undefined);
  });

  it("shows only supported Buyer destinations with Marketplace active", () => {
    render(<BuyerShell><main>Buyer content</main></BuyerShell>);

    expect(screen.getByRole("complementary", { name: "Buyer navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Marketplace" })).toHaveAttribute("href", "/marketplace");
    expect(screen.getByRole("link", { name: "Marketplace" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Saved Properties" })).toHaveAttribute("href", "/saved");
    expect(screen.getByRole("link", { name: "Refer & Earn" })).toHaveAttribute("href", "/refer");
    for (const prohibited of ["Payments", "Sub Accounts", "Save-as-you-earn", "Invest", "Support", "Settings"]) {
      expect(screen.queryByText(prohibited)).not.toBeInTheDocument();
    }
  });

  it("keeps Marketplace active on property detail routes", () => {
    mocks.pathname = "/marketplace/property-id";
    render(<BuyerShell><main>Property detail</main></BuyerShell>);
    expect(screen.getByRole("link", { name: "Marketplace" })).toHaveAttribute("aria-current", "page");
  });

  it("marks Saved and Refer & Earn from their canonical routes", () => {
    mocks.pathname = "/saved";
    const { rerender } = render(<BuyerShell><main>Saved</main></BuyerShell>);
    expect(screen.getByRole("link", { name: "Saved Properties" })).toHaveAttribute("aria-current", "page");

    mocks.pathname = "/referrals";
    rerender(<BuyerShell><main>Referrals</main></BuyerShell>);
    expect(screen.getByRole("link", { name: "Refer & Earn" })).toHaveAttribute("aria-current", "page");
  });

  it("uses canonical logout and returns directly to login", async () => {
    render(<BuyerShell><main>Buyer content</main></BuyerShell>);
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce());
    expect(mocks.replace).toHaveBeenCalledWith("/login");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("does not expose product navigation during Buyer onboarding or a Seller session", () => {
    mocks.session = { ...buyerSession, nextAction: "COMPLETE_BUYER_ONBOARDING" };
    const { rerender } = render(<BuyerShell><main>Focused flow</main></BuyerShell>);
    expect(screen.queryByRole("complementary", { name: "Buyer navigation" })).not.toBeInTheDocument();

    mocks.session = { ...buyerSession, activePersona: "SELLER_DEVELOPER", nextAction: "OPEN_SELLER_DASHBOARD" };
    rerender(<BuyerShell><main>Seller content</main></BuyerShell>);
    expect(screen.queryByRole("complementary", { name: "Buyer navigation" })).not.toBeInTheDocument();
  });

  it("provides an accessible responsive drawer contract", () => {
    render(<BuyerShell><main>Buyer content</main></BuyerShell>);
    const open = screen.getByRole("button", { name: "Open Buyer navigation" });
    expect(open).toHaveAttribute("aria-controls", "buyer-navigation");
    expect(open).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(open);
    expect(open).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("button", { name: "Close Buyer navigation" })).toHaveLength(2);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(open).toHaveAttribute("aria-expanded", "false");
  });
});
