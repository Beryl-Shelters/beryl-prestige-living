import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SellerListingManagementScreen } from "./seller-listing-management-screen";

const mocks = vi.hoisted(() => ({ push: vi.fn(), sellerListingManagement: vi.fn(), reopenSellerProperty: vi.fn(), createSellerDraft: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/api/client", () => ({ customerApi: mocks }));

const propertyId = "11111111-1111-4111-8111-111111111111";
const management = { summary: { id: propertyId, referenceId: "BRL-1001", title: "Four bedroom home", askingPrice: 250000000, status: "REJECTED", currentStep: "REVIEW", coverImage: null, photoCount: 2, updatedAt: "2026-08-18T12:00:00.000Z", submittedAt: null, reviewedAt: "2026-08-18T12:00:00.000Z", publishedAt: null, rejectedAt: "2026-08-18T12:00:00.000Z", rejectionReason: "Provide a clearer survey plan", rejectionFeedback: "Provide a clearer survey plan", reviewProgress: null, nextAction: "EDIT_REJECTED_LISTING" }, property: { id: propertyId, referenceId: "BRL-1001", title: "Four bedroom home", askingPrice: 250000000, status: "REJECTED", currentStep: "REVIEW", coverImage: null, photoCount: 2, updatedAt: "2026-08-18T12:00:00.000Z", submittedAt: null, reviewedAt: "2026-08-18T12:00:00.000Z", publishedAt: null, rejectedAt: "2026-08-18T12:00:00.000Z", rejectionReason: "Provide a clearer survey plan", rejectionFeedback: "Provide a clearer survey plan", reviewProgress: null, nextAction: "EDIT_REJECTED_LISTING", description: null, propertyCategory: "RESIDENTIAL", propertyType: "DETACHED", publicLocation: "Lekki, Lagos", fullAddress: "12 Private Street", images: [] }, documents: [], mandate: null, reviewHistory: [] };

function wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>; }

describe("Seller rejected listing correction", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.sellerListingManagement.mockResolvedValue({ success: true, data: { management } }); });

  it("shows only Seller-safe feedback and a real Make Changes button", async () => {
    render(<SellerListingManagementScreen propertyId={propertyId} />, { wrapper });
    expect(await screen.findByText("Provide a clearer survey plan")).toBeVisible();
    expect(screen.getByRole("button", { name: "Make Changes" })).toBeVisible();
    expect(screen.queryByText(/admin identity|reviewed by/i)).not.toBeInTheDocument();
  });

  it("reopens the existing property once, invalidates listing state, and enters the canonical edit flow", async () => {
    let resolve!: (value: unknown) => void;
    mocks.reopenSellerProperty.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<SellerListingManagementScreen propertyId={propertyId} />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: "Make Changes" }));
    await waitFor(() => expect(mocks.reopenSellerProperty).toHaveBeenCalledWith(propertyId));
    expect(mocks.createSellerDraft).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Opening listing…" })).toBeDisabled();
    resolve({ success: true, data: { propertyId, status: "DRAFT", currentStep: "REVIEW", nextAction: "EDIT_REJECTED_LISTING" } });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/seller/listings/${propertyId}/edit?step=REVIEW`));
  });

  it("keeps the rejected detail in place when reopen fails", async () => {
    mocks.reopenSellerProperty.mockRejectedValue(Object.assign(new Error("private database detail"), { isAxiosError: true, response: { data: { success: false, code: "LISTING_REOPEN_FAILED", message: "private database detail" } } }));
    render(<SellerListingManagementScreen propertyId={propertyId} />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: "Make Changes" }));
    expect(await screen.findByText("We could not reopen this listing. Please try again.")).toBeVisible();
    expect(screen.getByText("Provide a clearer survey plan")).toBeVisible();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
