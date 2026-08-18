import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SellerMandateStep } from "./seller-mandate-step";
import { SellerReviewStep } from "./seller-review-step";
import { incompleteSectionCopy } from "@/lib/seller-w5";

const mocks = vi.hoisted(() => ({
  push: vi.fn(), sellerMandate: vi.fn(), saveSellerMandate: vi.fn(), saveSellerDraft: vi.fn(),
  sellerReview: vi.fn(), submitSellerProperty: vi.fn()
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/api/client", () => ({ customerApi: mocks }));

const propertyId = "11111111-1111-4111-8111-111111111111";
const mandate = { mandateType: "EXCLUSIVE", sellerFullName: "Existing Seller", ownershipConfirmed: true, mandateAccepted: true, acceptedAt: "2026-08-18T10:00:00.000Z", agreementVersion: null, commissionPercentage: null, commissionAmount: null };
const review = {
  buyerPreview: { id: propertyId, referenceId: "BRL-1001", title: "Four bedroom home", description: "A complete description", propertyType: "DETACHED", propertyCategory: "RESIDENTIAL", publicLocation: "Lekki, Lagos", askingPrice: 250000000, negotiable: true, initialDeposit: null, condition: "NEWLY_BUILT", furnishing: null, bedrooms: 4, bathrooms: 4, toilets: 5, parkingSpaces: 3, numberOfFloors: null, parkingCapacity: null, amenities: ["Pool", "Security"], images: [{ id: "second", url: "https://res.cloudinary.com/demo/image/upload/second.jpg", order: 1, isCover: false }, { id: "cover", url: "https://res.cloudinary.com/demo/image/upload/cover.jpg", order: 0, isCover: true }], coverImage: { id: "cover", url: "https://res.cloudinary.com/demo/image/upload/cover.jpg", order: 0, isCover: true }, photoCount: 2 },
  sellerPrivate: { fullAddress: "12 Private Street" }, mandate, currentStep: "REVIEW", status: "DRAFT", validation: { missingSections: [], missingFields: [] }
};

function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason?: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function testWrapper(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) { return { client, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> }; }

describe("Seller Marketplace W5 flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sellerMandate.mockResolvedValue({ success: true, data: { mandate } });
    mocks.sellerReview.mockResolvedValue({ success: true, data: { review } });
  });

  it("restores the existing mandate without exposing server-owned terms as form inputs", async () => {
    render(<SellerMandateStep propertyId={propertyId} onBack={vi.fn()} />, testWrapper());
    expect(await screen.findByDisplayValue("Existing Seller")).toBeVisible();
    expect(screen.getByRole("radio", { name: "Exclusive Sales Mandate" })).toBeChecked();
    expect(mocks.sellerMandate).toHaveBeenCalledWith(propertyId);
    expect(screen.queryByLabelText(/accepted at|commission|agreement version/i)).not.toBeInTheDocument();
  });

  it("requires a type, trimmed name, ownership confirmation, and explicit acceptance", async () => {
    mocks.sellerMandate.mockResolvedValue({ success: true, data: { mandate: null } });
    render(<SellerMandateStep propertyId={propertyId} onBack={vi.fn()} />, testWrapper());
    fireEvent.click(await screen.findByRole("button", { name: "Continue to Review" }));
    expect(await screen.findByText("Choose a mandate type.")).toBeVisible();
    expect(screen.getByText("Enter the Seller's full name.")).toBeVisible();
    expect(screen.getByText(/Confirm that you own/)).toBeVisible();
    expect(screen.getByText("Accept the Sales Mandate before continuing.")).toBeVisible();
    expect(mocks.saveSellerMandate).not.toHaveBeenCalled();
  });

  it("saves OPEN using the existing property, then PATCHes REVIEW, and only then navigates", async () => {
    mocks.sellerMandate.mockResolvedValue({ success: true, data: { mandate: null } });
    const save = deferred<unknown>(); const patch = deferred<unknown>();
    mocks.saveSellerMandate.mockReturnValue(save.promise); mocks.saveSellerDraft.mockReturnValue(patch.promise);
    render(<SellerMandateStep propertyId={propertyId} onBack={vi.fn()} />, testWrapper());
    fireEvent.click(await screen.findByRole("radio", { name: "Open Sales Mandate" }));
    fireEvent.change(screen.getByLabelText("Seller full name"), { target: { value: "  Test Seller  " } });
    fireEvent.click(screen.getByRole("checkbox", { name: /I confirm/ })); fireEvent.click(screen.getByRole("checkbox", { name: /I acknowledge/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to Review" }));
    await waitFor(() => expect(mocks.saveSellerMandate).toHaveBeenCalledWith(propertyId, { mandateType: "OPEN", sellerFullName: "Test Seller", ownershipConfirmed: true, mandateAccepted: true }));
    expect(mocks.saveSellerDraft).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled();
    save.resolve({}); await waitFor(() => expect(mocks.saveSellerDraft).toHaveBeenCalledWith(propertyId, { currentStep: "REVIEW" }));
    expect(mocks.push).not.toHaveBeenCalled(); patch.resolve({});
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/seller/listings/${propertyId}/edit?step=REVIEW`));
  });

  it("requests authoritative review data and renders safe information, ordered images, mandate, and canonical edit links", async () => {
    render(<SellerReviewStep propertyId={propertyId} />, testWrapper());
    expect(await screen.findByText("Four bedroom home")).toBeVisible();
    expect(screen.getByText("BRL-1001")).toBeVisible(); expect(screen.getByText("Exclusive Sales Mandate")).toBeVisible();
    expect(mocks.sellerReview).toHaveBeenCalledWith(propertyId);
    const gallery = screen.getByText("Cover").parentElement?.parentElement as HTMLElement;
    expect(within(gallery).getAllByRole("img")[0]).toHaveAttribute("alt", "Four bedroom home photo 1");
    const editLinks = screen.getAllByRole("link", { name: "Edit" }).map((link) => link.getAttribute("href"));
    expect(editLinks).toEqual(expect.arrayContaining([`/seller/listings/${propertyId}/edit?step=property-information`, `/seller/listings/${propertyId}/edit?step=photos-documents`, `/seller/listings/${propertyId}/edit?step=SALES_MANDATE`]));
  });

  it("prevents duplicate submit, shows a reference-only success confirmation, and refreshes Seller caches", async () => {
    const submit = deferred<{ success: true; data: { propertyId: string; referenceId: string; status: "IN_REVIEW"; submittedAt: string; nextAction: "OPEN_MY_LISTINGS" } }>();
    mocks.submitSellerProperty.mockReturnValue(submit.promise);
    const { client, wrapper } = testWrapper(); const invalidate = vi.spyOn(client, "invalidateQueries");
    render(<SellerReviewStep propertyId={propertyId} />, { wrapper });
    const button = await screen.findByRole("button", { name: "Submit for Review" }); fireEvent.click(button); fireEvent.click(button);
    expect(mocks.submitSellerProperty).toHaveBeenCalledTimes(1); expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled();
    submit.resolve({ success: true, data: { propertyId, referenceId: "BRL-1001", status: "IN_REVIEW", submittedAt: "2026-08-18T12:00:00.000Z", nextAction: "OPEN_MY_LISTINGS" } });
    expect(await screen.findByText("Your property has been submitted for review")).toBeVisible(); expect(screen.getByText("BRL-1001")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open My Listings" })).toHaveAttribute("href", "/seller/listings");
    expect(screen.queryByText(/24 hours|48 hours|working days/i)).not.toBeInTheDocument();
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["seller-marketplace-listings"] }));
  });

  it("renders incomplete submission safely with section-specific correction links", async () => {
    mocks.submitSellerProperty.mockRejectedValue(Object.assign(new Error("raw database text"), { isAxiosError: true, response: { data: { success: false, code: "LISTING_SUBMISSION_INCOMPLETE", message: "raw database text", missingSections: ["PHOTOS", "SALES_MANDATE"], missingFields: ["coverImage", "mandate"] } } }));
    render(<SellerReviewStep propertyId={propertyId} />, testWrapper());
    fireEvent.click(await screen.findByRole("button", { name: "Submit for Review" }));
    expect(await screen.findByText("Your listing still needs attention before it can be submitted.")).toBeVisible();
    expect(screen.queryByText("raw database text")).not.toBeInTheDocument();
    expect(screen.getByText(incompleteSectionCopy.PHOTOS)).toBeVisible(); expect(screen.getByText(incompleteSectionCopy.SALES_MANDATE)).toBeVisible();
  });
});
