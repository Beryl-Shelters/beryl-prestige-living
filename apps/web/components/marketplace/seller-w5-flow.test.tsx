import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SellerMandateStep } from "./seller-mandate-step";
import { SellerReviewStep } from "./seller-review-step";
import { incompleteSectionCopy } from "@/lib/seller-w5";

const mocks = vi.hoisted(() => ({
  push: vi.fn(), replace: vi.fn(), sellerMandate: vi.fn(), saveSellerMandate: vi.fn(), saveSellerDraft: vi.fn(),
  sellerReview: vi.fn(), submitSellerProperty: vi.fn()
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));
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
    expect(screen.getByRole("radio", { name: /^Exclusive Sales Mandate/ })).toBeChecked();
    expect(mocks.sellerMandate).toHaveBeenCalledWith(propertyId);
    expect(screen.queryByLabelText(/accepted at|commission|agreement version/i)).not.toBeInTheDocument();
  });

  it("treats MANDATE_NOT_FOUND as the normal empty first-visit form", async () => {
    mocks.sellerMandate.mockRejectedValue(Object.assign(new Error("not found"), { isAxiosError: true, response: { status: 404, data: { success: false, message: "Sales mandate not found", code: "MANDATE_NOT_FOUND" } } }));
    render(<SellerMandateStep propertyId={propertyId} onBack={vi.fn()} />, testWrapper());
    expect(await screen.findByRole("heading", { name: "Will you also use other agents?" })).toBeVisible();
    expect(screen.getByLabelText("Seller full name")).toHaveValue("");
    expect(screen.queryByText("We could not restore the Sales Mandate.")).not.toBeInTheDocument();
    expect(mocks.sellerMandate).toHaveBeenCalledWith(propertyId);
  });

  it("shows restore failure for a genuine unexpected mandate error", async () => {
    mocks.sellerMandate.mockRejectedValue(Object.assign(new Error("server failure"), { isAxiosError: true, response: { status: 500, data: { success: false, message: "Unavailable", code: "MANDATE_UNAVAILABLE" } } }));
    render(<SellerMandateStep propertyId={propertyId} onBack={vi.fn()} />, testWrapper());
    expect(await screen.findByText("We could not restore the Sales Mandate.")).toBeVisible();
  });

  it("requires a type, trimmed name, ownership confirmation, and explicit acceptance", async () => {
    mocks.sellerMandate.mockResolvedValue({ success: true, data: { mandate: null } });
    render(<SellerMandateStep propertyId={propertyId} onBack={vi.fn()} />, testWrapper());
    fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Choose a mandate type.")).toBeVisible();
    expect(screen.getByText("Enter the Seller's full name.")).toBeVisible();
    expect(screen.getByText(/Confirm that you own/)).toBeVisible();
    expect(screen.getByText("Accept the Sales Mandate before continuing.")).toBeVisible();
    expect(mocks.saveSellerMandate).not.toHaveBeenCalled();
  });

  it("saves a structurally valid but incomplete Step 3 draft once and redirects only after success", async () => {
    mocks.sellerMandate.mockResolvedValue({ success: true, data: { mandate: null } });
    const save = deferred<unknown>();
    mocks.saveSellerMandate.mockReturnValueOnce(save.promise);
    render(<SellerMandateStep propertyId={propertyId} onBack={vi.fn()} />, testWrapper());
    fireEvent.click(await screen.findByRole("radio", { name: /^Open Sales Mandate/ }));
    fireEvent.change(screen.getByLabelText("Seller full name"), { target: { value: "  Test Seller  " } });
    const saveButton = screen.getByRole("button", { name: "Save as draft" });

    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    await waitFor(() => expect(mocks.saveSellerMandate).toHaveBeenCalledTimes(1));
    expect(mocks.saveSellerMandate).toHaveBeenCalledWith(propertyId, { mandateType: "OPEN", sellerFullName: "Test Seller", ownershipConfirmed: false, mandateAccepted: false });
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(mocks.replace).not.toHaveBeenCalled();

    save.resolve({ success: true });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/seller/listings"));
    expect(mocks.saveSellerDraft).not.toHaveBeenCalled();
  });

  it("saves an untouched Step 3 as an incomplete property draft without requiring a mandate", async () => {
    mocks.sellerMandate.mockResolvedValue({ success: true, data: { mandate: null } });
    const save = deferred<unknown>();
    mocks.saveSellerDraft.mockReturnValueOnce(save.promise);
    render(<SellerMandateStep propertyId={propertyId} onBack={vi.fn()} />, testWrapper());

    const saveButton = await screen.findByRole("button", { name: "Save as draft" });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    await waitFor(() => expect(mocks.saveSellerDraft).toHaveBeenCalledTimes(1));
    expect(mocks.saveSellerDraft).toHaveBeenCalledWith(propertyId, { currentStep: "SALES_MANDATE" });
    expect(mocks.saveSellerMandate).not.toHaveBeenCalled();
    expect(screen.queryByText("Choose a mandate type.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(mocks.replace).not.toHaveBeenCalled();

    save.resolve({ success: true });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/seller/listings"));
  });

  it("keeps Step 3 values after failure and permits a successful retry", async () => {
    mocks.saveSellerMandate.mockRejectedValueOnce(new Error("save failed")).mockResolvedValueOnce({ success: true });
    render(<SellerMandateStep propertyId={propertyId} onBack={vi.fn()} />, testWrapper());
    expect(await screen.findByDisplayValue("Existing Seller")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(await screen.findByText("Something went wrong. Please try again.")).toBeVisible();
    expect(screen.getByLabelText("Seller full name")).toHaveValue("Existing Seller");
    expect(screen.getByRole("button", { name: "Save as draft" })).toBeEnabled();
    expect(mocks.replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(mocks.saveSellerMandate).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/seller/listings"));
  });

  it("saves OPEN using the existing property, then PATCHes REVIEW, and only then navigates", async () => {
    mocks.sellerMandate.mockResolvedValue({ success: true, data: { mandate: null } });
    const save = deferred<unknown>(); const patch = deferred<unknown>();
    mocks.saveSellerMandate.mockReturnValue(save.promise); mocks.saveSellerDraft.mockReturnValue(patch.promise);
    render(<SellerMandateStep propertyId={propertyId} onBack={vi.fn()} />, testWrapper());
    fireEvent.click(await screen.findByRole("radio", { name: /^Open Sales Mandate/ }));
    fireEvent.change(screen.getByLabelText("Seller full name"), { target: { value: "  Test Seller  " } });
    fireEvent.click(screen.getByRole("checkbox", { name: /I confirm/ })); fireEvent.click(screen.getByRole("checkbox", { name: /I acknowledge/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(mocks.saveSellerMandate).toHaveBeenCalledWith(propertyId, { mandateType: "OPEN", sellerFullName: "Test Seller", ownershipConfirmed: true, mandateAccepted: true }));
    expect(mocks.saveSellerDraft).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled();
    save.resolve({}); await waitFor(() => expect(mocks.saveSellerDraft).toHaveBeenCalledWith(propertyId, { currentStep: "REVIEW" }));
    expect(mocks.push).not.toHaveBeenCalled(); patch.resolve({});
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/seller/listings/${propertyId}/edit?step=REVIEW`));
  });

  it("stays on Sales Mandate and does not PATCH REVIEW when mandate PUT fails", async () => {
    mocks.sellerMandate.mockResolvedValue({ success: true, data: { mandate: null } });
    mocks.saveSellerMandate.mockRejectedValue(new Error("save failed"));
    render(<SellerMandateStep propertyId={propertyId} onBack={vi.fn()} />, testWrapper());
    fireEvent.click(await screen.findByRole("radio", { name: /^Exclusive Sales Mandate/ }));
    fireEvent.change(screen.getByLabelText("Seller full name"), { target: { value: "Test Seller" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /I confirm/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /I acknowledge/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("We could not continue to Review. Please try again.")).toBeVisible();
    expect(mocks.saveSellerMandate).toHaveBeenCalledWith(propertyId, { mandateType: "EXCLUSIVE", sellerFullName: "Test Seller", ownershipConfirmed: true, mandateAccepted: true });
    expect(mocks.saveSellerDraft).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("renders the approved compact and expanded buyer preview with canonical edit links", async () => {
    mocks.sellerReview.mockResolvedValueOnce({ success: true, data: { review: { ...review, buyerPreview: { ...review.buyerPreview, furnishing: "SEMI_FURNISHED", initialDeposit: { type: "PERCENTAGE", value: 25 } } } } });
    render(<SellerReviewStep propertyId={propertyId} />, testWrapper());
    expect(await screen.findByRole("heading", { name: "Review your property listing" })).toBeVisible();
    expect(screen.getByText("Here is what we’ll show to buyers. Before you submit your listing, make sure to review the details.")).toBeVisible();
    expect(screen.getByText("₦250,000,000")).toBeVisible();
    expect(screen.getByText("Four bedroom home")).toBeVisible();
    expect(screen.getByText("Detached")).toBeVisible();
    expect(screen.getByText("Lekki, Lagos")).toBeVisible();
    expect(screen.getByText("4 Beds")).toBeVisible();
    expect(screen.getByText("4 Baths")).toBeVisible();
    expect(screen.getByText("5 Toilets")).toBeVisible();
    expect(screen.getByText("3 Parking spaces")).toBeVisible();
    expect(mocks.sellerReview).toHaveBeenCalledWith(propertyId);
    const preview = screen.getByRole("article", { name: "Buyer listing preview" });
    expect(within(preview).getByRole("img", { name: "Four bedroom home cover photo" })).toBeVisible();
    expect(preview.querySelector('[data-cover-image="true"]')).toBeTruthy();
    expect(screen.getByText("1/2")).toBeVisible();
    expect(screen.getByRole("link", { name: "Edit property information" })).toHaveAttribute("href", `/seller/listings/${propertyId}/edit?step=property-information`);
    expect(screen.getByRole("link", { name: "Edit photos and documents" })).toHaveAttribute("href", `/seller/listings/${propertyId}/edit?step=photos-documents`);
    expect(screen.getByRole("link", { name: "Edit Sales Mandate" })).toHaveAttribute("href", `/seller/listings/${propertyId}/edit?step=SALES_MANDATE`);
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", `/seller/listings/${propertyId}/edit?step=SALES_MANDATE`);
    expect(screen.getByRole("button", { name: "Submit for Review" })).toBeEnabled();
    expect(screen.queryByText("Existing Seller")).not.toBeInTheDocument();
    expect(screen.queryByText("12 Private Street")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "See the full buyer view" }));
    expect(screen.getByRole("button", { name: "Change view" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "About this property" })).toBeVisible();
    expect(screen.getByText("A complete description")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Property details" })).toBeVisible();
    expect(screen.getByText("Semi Furnished")).toBeVisible();
    expect(screen.getByText("25%")).toBeVisible();
    expect(screen.getByText("BRL-1001")).toBeVisible();
    expect(screen.getByRole("heading", { name: "What’s included" })).toBeVisible();
    expect(within(preview).getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent)).toEqual(["About this property", "Property details", "What’s included"]);
    expect(screen.getByText("Pool")).toBeVisible();
    expect(screen.getByText("Security")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next property photo" }));
    expect(screen.getByRole("img", { name: "Four bedroom home photo" })).toBeVisible();
  });

  it("omits absent optional buyer-preview values without leaking nulls or inventing content", async () => {
    mocks.sellerReview.mockResolvedValueOnce({
      success: true,
      data: { review: { ...review, mandate: null, sellerPrivate: { fullAddress: null }, buyerPreview: { ...review.buyerPreview, title: null, description: null, propertyType: null, propertyCategory: null, publicLocation: null, askingPrice: null, negotiable: false, initialDeposit: null, condition: null, furnishing: null, bedrooms: null, bathrooms: null, toilets: null, parkingSpaces: null, numberOfFloors: null, parkingCapacity: null, amenities: [], images: [], coverImage: null, photoCount: 0 } } }
    });
    render(<SellerReviewStep propertyId={propertyId} />, testWrapper());
    expect(await screen.findByText("Price not provided")).toBeVisible();
    expect(screen.getByText("Untitled property")).toBeVisible();
    expect(screen.getByText("Property image unavailable")).toBeVisible();
    expect(screen.queryByText(/undefined|null/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Property facts")).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole("button", { name: "See the full buyer view" }));
    expect(screen.queryByRole("heading", { name: "About this property" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "What’s included" })).not.toBeInTheDocument();
    expect(screen.getByText("BRL-1001")).toBeVisible();
    expect(mocks.submitSellerProperty).not.toHaveBeenCalled();
  });

  it("prevents duplicate submit, shows a reference-only success confirmation, and refreshes Seller caches", async () => {
    const submit = deferred<{ success: true; data: { propertyId: string; referenceId: string; status: "IN_REVIEW"; submittedAt: string; nextAction: "OPEN_MY_LISTINGS" } }>();
    mocks.submitSellerProperty.mockReturnValue(submit.promise);
    const { client, wrapper } = testWrapper(); const invalidate = vi.spyOn(client, "invalidateQueries");
    render(<SellerReviewStep propertyId={propertyId} />, { wrapper });
    const button = await screen.findByRole("button", { name: "Submit for Review" }); fireEvent.click(button); fireEvent.click(button);
    expect(mocks.submitSellerProperty).toHaveBeenCalledTimes(1); expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled();
    submit.resolve({ success: true, data: { propertyId, referenceId: "BRL-1001", status: "IN_REVIEW", submittedAt: "2026-08-18T12:00:00.000Z", nextAction: "OPEN_MY_LISTINGS" } });
    expect(await screen.findByText("Your listing has been submitted to our team")).toBeVisible(); expect(screen.getByText("BRL-1001")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open My Listings" })).toHaveAttribute("href", "/seller/listings");
    expect(screen.queryByText(/24 hours|48 hours|working days/i)).not.toBeInTheDocument();
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["seller-marketplace-listings"], refetchType: "all" }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["seller-marketplace-management", propertyId], refetchType: "all" });
    expect(invalidate).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["seller-draft", propertyId] }));
    expect(invalidate).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: ["seller-review", propertyId] }));
  });

  it("uses authoritative Review validation before sending an incomplete property", async () => {
    mocks.sellerReview.mockResolvedValueOnce({
      success: true,
      data: { review: { ...review, validation: { missingSections: ["PROPERTY_INFORMATION", "PHOTOS"], missingFields: ["description", "coverImage"] } } }
    });
    render(<SellerReviewStep propertyId={propertyId} />, testWrapper());
    fireEvent.click(await screen.findByRole("button", { name: "Submit for Review" }));

    expect(await screen.findByText("Your listing still needs attention before it can be submitted.")).toBeVisible();
    expect(screen.getByText(incompleteSectionCopy.PROPERTY_INFORMATION)).toBeVisible();
    expect(screen.getByText(incompleteSectionCopy.PHOTOS)).toBeVisible();
    await waitFor(() => expect(document.getElementById("seller-review-validation")).toHaveFocus());
    expect(mocks.submitSellerProperty).not.toHaveBeenCalled();
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
