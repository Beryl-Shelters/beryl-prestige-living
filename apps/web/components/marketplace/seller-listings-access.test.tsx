import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SellerListingsScreen } from "./seller-listings-screen";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), sellerListings: vi.fn(), session: null as null | Record<string, unknown> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/context/auth-provider", () => ({ useAuth: () => ({ session: mocks.session, sessionLoading: false }) }));
vi.mock("@/lib/api/client", () => ({ customerApi: { sellerListings: mocks.sellerListings } }));
vi.mock("@/components/persona/persona-switcher", () => ({ PersonaSwitcher: () => null }));

const result = { success: true, data: { counts: { all: 0, draft: 0, inReview: 0, live: 0, rejected: 0 }, items: [], pagination: { page: 1, limit: 12, total: 0, total_pages: 0 } } };
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;

describe("Seller listings persona guard", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.sellerListings.mockResolvedValue(result); });

  it("permits an active completed Seller and loads listings after refresh", async () => {
    mocks.session = { activePersona: "SELLER_DEVELOPER", personas: [{ type: "BUYER", onboardingStatus: "COMPLETED" }, { type: "SELLER_DEVELOPER", onboardingStatus: "COMPLETED", activated: true }] };
    render(<SellerListingsScreen />, { wrapper });
    expect(await screen.findByRole("heading", { name: "My Listings" })).toBeVisible();
    await waitFor(() => expect(mocks.sellerListings).toHaveBeenCalledWith({ status: "ALL", page: 1, limit: 12 }));
    expect(screen.queryByText(/Seller access required/i)).not.toBeInTheDocument();
  });

  it("routes an active incomplete Seller to onboarding without requesting listings", async () => {
    mocks.session = { activePersona: "SELLER_DEVELOPER", personas: [{ type: "SELLER_DEVELOPER", onboardingStatus: "IN_PROGRESS", activated: true }] };
    render(<SellerListingsScreen />, { wrapper });
    expect(screen.getByRole("heading", { name: "Complete your Seller profile" })).toBeVisible();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/onboarding/seller"));
    expect(mocks.sellerListings).not.toHaveBeenCalled();
  });

  it("distinguishes an activated inactive Seller from an unactivated Seller", () => {
    mocks.session = { activePersona: "BUYER", personas: [{ type: "BUYER", onboardingStatus: "COMPLETED" }, { type: "SELLER_DEVELOPER", onboardingStatus: "COMPLETED", activated: true }] };
    const view = render(<SellerListingsScreen />, { wrapper });
    expect(screen.getByRole("heading", { name: "Switch to your Seller profile" })).toBeVisible();
    view.unmount();
    mocks.session = { activePersona: "BUYER", personas: [{ type: "BUYER", onboardingStatus: "COMPLETED" }] };
    render(<SellerListingsScreen />, { wrapper });
    expect(screen.getByRole("heading", { name: "Activate your Seller profile" })).toBeVisible();
  });
});
