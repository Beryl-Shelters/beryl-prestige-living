import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerSessionState } from "@/lib/contracts";
import { SellerShell } from "./seller-shell";

const mocks = vi.hoisted(() => ({
  pathname: "/seller/listings",
  replace: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  personaOpen: false,
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

vi.mock("@/components/persona/persona-switcher", () => ({
  PersonaSwitcher: ({ open }: { open: boolean }) => {
    mocks.personaOpen = open;
    return open ? <div>Persona switcher open</div> : null;
  },
}));

const sellerSession = {
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "Victor Beryl",
    email: "victor@example.com",
  },
  activePersona: "SELLER_DEVELOPER",
  personas: [{ type: "SELLER_DEVELOPER", onboardingStatus: "COMPLETED" }],
  nextAction: "OPEN_SELLER_DASHBOARD",
} as CustomerSessionState;

const prohibitedItems = [
  "Payments",
  "Sub Accounts",
  "Subaccounts",
  "Save-as-you-earn",
  "Invest",
  "Support",
  "Settings",
];

describe("SellerShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = "/seller/listings";
    mocks.session = sellerSession;
    mocks.personaOpen = false;
    mocks.logout.mockResolvedValue(undefined);
  });

  it("shows only real Seller destinations and keeps My Listings active", () => {
    render(<SellerShell><main>Seller content</main></SellerShell>);

    expect(screen.getByRole("complementary", { name: "Seller navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Listings" })).toHaveAttribute("href", "/seller/listings");
    expect(screen.getByRole("link", { name: "My Listings" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Refer & Earn" })).toHaveAttribute("href", "/refer");
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add Property" })).not.toBeInTheDocument();
    for (const prohibited of prohibitedItems) {
      expect(screen.queryByText(prohibited)).not.toBeInTheDocument();
    }
  });

  it.each([
    "/seller",
    "/seller/listings/new",
    "/seller/listings/property-id",
    "/seller/listings/property-id/edit",
  ])("keeps My Listings active on %s", (pathname) => {
    mocks.pathname = pathname;
    render(<SellerShell><main>Listing route</main></SellerShell>);

    expect(screen.getByRole("link", { name: "My Listings" })).toHaveAttribute("aria-current", "page");
  });

  it.each(["/refer", "/referrals"])("marks Refer & Earn active on %s", (pathname) => {
    mocks.pathname = pathname;
    render(<SellerShell><main>Referral route</main></SellerShell>);

    expect(screen.getByRole("link", { name: "Refer & Earn" })).toHaveAttribute("aria-current", "page");
  });

  it("uses canonical logout and returns directly to login", async () => {
    render(<SellerShell><main>Seller content</main></SellerShell>);
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce());
    expect(mocks.replace).toHaveBeenCalledWith("/login");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("preserves the profile control that opens canonical persona switching", () => {
    render(<SellerShell><main>Seller content</main></SellerShell>);
    fireEvent.click(screen.getByRole("button", { name: "Open profile switcher" }));

    expect(screen.getByText("Persona switcher open")).toBeInTheDocument();
    expect(mocks.personaOpen).toBe(true);
  });

  it("provides an accessible responsive drawer without prohibited items", () => {
    render(<SellerShell><main>Seller content</main></SellerShell>);
    const open = screen.getByRole("button", { name: "Open Seller navigation" });

    expect(open).toHaveAttribute("aria-controls", "seller-navigation");
    expect(open).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(open);
    expect(open).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("button", { name: "Close Seller navigation" })).toHaveLength(2);
    for (const prohibited of prohibitedItems) {
      expect(screen.queryByText(prohibited)).not.toBeInTheDocument();
    }

    fireEvent.keyDown(document, { key: "Escape" });
    expect(open).toHaveAttribute("aria-expanded", "false");
  });
});
