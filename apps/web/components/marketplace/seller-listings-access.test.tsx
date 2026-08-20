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

  it("renders authoritative submitted metadata and action for an IN_REVIEW listing", async () => {
    mocks.session = { activePersona: "SELLER_DEVELOPER", personas: [{ type: "SELLER_DEVELOPER", onboardingStatus: "COMPLETED", activated: true }] };
    mocks.sellerListings.mockResolvedValue({ success: true, data: {
      counts: { all: 1, draft: 0, inReview: 1, live: 0, rejected: 0 },
      items: [{
        id: "11111111-1111-4111-8111-111111111111", referenceId: "BRL-1001", title: "Four bedroom home", askingPrice: 250000000,
        status: "IN_REVIEW", currentStep: "REVIEW", coverImage: null, photoCount: 1, updatedAt: "2026-08-20T12:00:00.000Z",
        submittedAt: "2026-08-20T12:00:00.000Z", reviewedAt: null, publishedAt: null, rejectedAt: null,
        rejectionReason: null, rejectionFeedback: null, reviewProgress: { submitted: true, reviewing: true, live: false }, nextAction: "VIEW_REVIEW_STATUS"
      }],
      pagination: { page: 1, limit: 12, total: 1, total_pages: 1 }
    } });

    render(<SellerListingsScreen />, { wrapper });
    expect(await screen.findByText("Four bedroom home")).toBeVisible();
    expect(screen.getAllByText("In Review")).toHaveLength(2);
    expect(screen.getByText(/^Sent /)).toBeVisible();
    expect(screen.getByRole("link", { name: "View details" })).toHaveAttribute("href", "/seller/listings/11111111-1111-4111-8111-111111111111");
    expect(screen.getByRole("tab", { name: /In Review/ })).toHaveTextContent("1");
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
