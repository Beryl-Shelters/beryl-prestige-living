import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SellerDraftEditor } from "./seller-draft-editor";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  sellerDraft: vi.fn(),
  saveSellerDraft: vi.fn(),
  createSellerDraft: vi.fn()
  ,sellerMandate: vi.fn(), sellerReview: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace })
}));

vi.mock("@/lib/api/client", () => ({
  customerApi: {
    sellerDraft: mocks.sellerDraft,
    saveSellerDraft: mocks.saveSellerDraft,
    createSellerDraft: mocks.createSellerDraft,
    uploadSellerImages: vi.fn(),
    deleteSellerImage: vi.fn(),
    reorderSellerImages: vi.fn(),
    setSellerCover: vi.fn(),
    uploadSellerDocument: vi.fn(),
    deleteSellerDocument: vi.fn()
    ,sellerMandate: mocks.sellerMandate,
    saveSellerMandate: vi.fn(),
    sellerReview: mocks.sellerReview,
    submitSellerProperty: vi.fn()
  }
}));

const propertyId = "11111111-1111-4111-8111-111111111111";
const restoredDraft = {
  success: true,
  data: {
    property: {
      id: propertyId,
      currentStep: "PHOTOS_DOCUMENTS",
      images: [],
      documents: []
    }
  }
};

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("Seller draft Step 2 transition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sellerDraft.mockResolvedValue(restoredDraft);
    mocks.sellerMandate.mockResolvedValue({ success: true, data: { mandate: null } });
    mocks.sellerReview.mockResolvedValue({ success: true, data: { review: null } });
  });

  it("PATCHes the existing draft, waits, disables Continue, and navigates once successful", async () => {
    const request = deferred<typeof restoredDraft>();
    mocks.saveSellerDraft.mockReturnValue(request.promise);
    render(<SellerDraftEditor propertyId={propertyId} initialStep="PHOTOS_DOCUMENTS" />, { wrapper });

    const continueButton = await screen.findByRole("button", { name: "Continue" });
    fireEvent.click(continueButton);

    expect(mocks.saveSellerDraft).toHaveBeenCalledTimes(1);
    expect(mocks.saveSellerDraft).toHaveBeenCalledWith(propertyId, { currentStep: "SALES_MANDATE" });
    expect(mocks.createSellerDraft).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();

    request.resolve(restoredDraft);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/seller/listings/${propertyId}/edit?step=SALES_MANDATE`));
  });

  it("stays on Step 2 and re-enables Continue when PATCH fails", async () => {
    mocks.saveSellerDraft.mockRejectedValue(new Error("network"));
    render(<SellerDraftEditor propertyId={propertyId} initialStep="PHOTOS_DOCUMENTS" />, { wrapper });

    fireEvent.click(await screen.findByRole("button", { name: "Continue" }));

    expect(await screen.findByText("We could not continue to the Sales Mandate step. Please try again.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Photos & documents" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("recognizes the Step 3 query state without creating another draft", async () => {
    render(<SellerDraftEditor propertyId={propertyId} initialStep="SALES_MANDATE" />, { wrapper });

    expect(await screen.findByRole("heading", { name: "Sales Mandate" })).toBeVisible();
    expect(screen.getByText("Step 3 of 4")).toBeVisible();
    expect(mocks.createSellerDraft).not.toHaveBeenCalled();
    expect(mocks.saveSellerDraft).not.toHaveBeenCalled();
  });
});
