import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SellerDraftEditor } from "./seller-draft-editor";

const mocks = vi.hoisted(() => ({ create: vi.fn(), save: vi.fn(), restore: vi.fn(), management: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: mocks.replace }) }));
vi.mock("@/lib/api/client", () => ({ customerApi: {
  createSellerDraft: mocks.create, saveSellerDraft: mocks.save, sellerDraft: mocks.restore, sellerListingManagement: mocks.management,
  uploadSellerImages: vi.fn(), deleteSellerImage: vi.fn(), reorderSellerImages: vi.fn(), setSellerCover: vi.fn(), uploadSellerDocument: vi.fn(), deleteSellerDocument: vi.fn()
} }));

const propertyId = "11111111-1111-4111-8111-111111111111";
const created = { success: true, data: { property: { id: propertyId, currentStep: "PROPERTY_INFORMATION", images: [], documents: [] } } };
function wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>; }
const fillRequired = () => {
  fireEvent.change(screen.getByLabelText("Property Title"), { target: { value: "Four bedroom home" } });
  fireEvent.change(screen.getByLabelText("Property type"), { target: { value: "DUPLEX" } });
  fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Lekki, Lagos" } });
  fireEvent.change(screen.getByLabelText("Full address"), { target: { value: "12 Private Street" } });
  fireEvent.change(screen.getByLabelText("Asking price (NGN)"), { target: { value: "250000000" } });
};

describe("Seller draft Step 1 persistence", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.create.mockResolvedValue(created); mocks.save.mockResolvedValue(created); mocks.restore.mockResolvedValue(created); mocks.management.mockResolvedValue({ success: true, data: { management: { summary: { status: "DRAFT", rejectionFeedback: null, rejectionReason: null } } } }); });

  it("creates one canonical partial draft from Save as draft", async () => {
    render(<SellerDraftEditor />, { wrapper });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty("description");
    expect(mocks.replace).toHaveBeenCalledWith(`/seller/listings/${propertyId}/edit`);
  });

  it("persists required information once and reaches PHOTOS_DOCUMENTS", async () => {
    render(<SellerDraftEditor />, { wrapper });
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Photos & documents" });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ title: "Four bedroom home", propertyType: "DUPLEX", publicLocation: "Lekki, Lagos", fullAddress: "12 Private Street", askingPrice: 250000000, currentStep: "PHOTOS_DOCUMENTS" });
  });
});
