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
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}
const fillRequired = () => {
  fireEvent.change(screen.getByLabelText("Property Title"), { target: { value: "Four bedroom home" } });
  fireEvent.change(screen.getByLabelText("Property Type"), { target: { value: "DUPLEX" } });
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "A complete property description" } });
  fireEvent.click(screen.getByRole("radio", { name: /Personal/ }));
  fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Lekki, Lagos" } });
  fireEvent.change(screen.getByLabelText("Full address"), { target: { value: "12 Private Street" } });
  fireEvent.change(screen.getByLabelText("Asking price"), { target: { value: "250000000" } });
  fireEvent.click(screen.getByRole("radio", { name: "Newly Built" }));
};

describe("Seller draft Step 1 persistence", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.create.mockResolvedValue(created); mocks.save.mockResolvedValue(created); mocks.restore.mockResolvedValue(created); mocks.management.mockResolvedValue({ success: true, data: { management: { summary: { status: "DRAFT", rejectionFeedback: null, rejectionReason: null } } } }); });

  it("creates one canonical partial draft and redirects to My Listings only after Save as draft succeeds", async () => {
    const request = deferred<typeof created>();
    mocks.create.mockReturnValueOnce(request.promise);
    render(<SellerDraftEditor />, { wrapper });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty("description");
    expect(mocks.replace).not.toHaveBeenCalledWith("/seller/listings");
    request.resolve(created);
    await waitFor(() => expect(mocks.replace).toHaveBeenLastCalledWith("/seller/listings"));
    expect(mocks.replace).toHaveBeenCalledWith(`/seller/listings/${propertyId}/edit`);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("updates an existing draft by its canonical ID without creating a duplicate, then redirects", async () => {
    render(<SellerDraftEditor propertyId={propertyId} />, { wrapper });
    await screen.findByLabelText("Property Title");
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(propertyId, expect.any(Object)));
    await waitFor(() => expect(mocks.replace).toHaveBeenLastCalledWith("/seller/listings"));
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("blocks duplicate requests while saving an incomplete draft", async () => {
    const request = deferred<typeof created>();
    mocks.create.mockReturnValueOnce(request.promise);
    render(<SellerDraftEditor />, { wrapper });
    const saveButton = screen.getByRole("button", { name: "Save as draft" });

    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Save as draft" })).toBeDisabled();
    expect(mocks.replace).not.toHaveBeenCalledWith("/seller/listings");

    request.resolve(created);
    await waitFor(() => expect(mocks.replace).toHaveBeenLastCalledWith("/seller/listings"));
  });

  it("stays on Step 1 after failure, preserves values, and redirects after a successful retry", async () => {
    mocks.create.mockRejectedValueOnce(Object.assign(new Error("storage failure"), { isAxiosError: true, response: { data: { success: false, message: "Property draft could not be saved", code: "DRAFT_PERSISTENCE_UNAVAILABLE" } } }));
    render(<SellerDraftEditor />, { wrapper });
    fireEvent.change(screen.getByLabelText("Property Title"), { target: { value: "My unfinished home" } });
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));

    expect(await screen.findByText("We couldn’t save this property draft right now. Please try again.")).toBeVisible();
    expect(screen.getByLabelText("Property Title")).toHaveValue("My unfinished home");
    expect(screen.getByRole("button", { name: "Save as draft" })).toBeEnabled();
    expect(mocks.replace).not.toHaveBeenCalledWith("/seller/listings");

    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.replace).toHaveBeenLastCalledWith("/seller/listings"));
  });

  it("keeps Step 1 in place, renders field errors, focuses the first invalid field, and clears corrected errors", async () => {
    render(<SellerDraftEditor />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Enter a property title.")).toBeVisible();
    expect(screen.getByText("Enter a property description.")).toBeVisible();
    expect(screen.getByText("Select a supported property type.")).toBeVisible();
    expect(screen.getByText("Select who owns this property.")).toBeVisible();
    expect(screen.getByText("Enter the public property location.")).toBeVisible();
    expect(screen.getByText("Enter the full property address.")).toBeVisible();
    expect(screen.getByText("Enter the asking price.")).toBeVisible();
    expect(screen.getByText("Select the property condition.")).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText("Property Title")).toHaveFocus());
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Property Title"), { target: { value: "Four bedroom home" } });
    expect(screen.queryByText("Enter a property title.")).not.toBeInTheDocument();
    expect(screen.getByText("Enter a property description.")).toBeVisible();
  });

  it("persists required information once and reaches PHOTOS_DOCUMENTS", async () => {
    render(<SellerDraftEditor />, { wrapper });
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Add some photos of the property to show buyers" });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ title: "Four bedroom home", propertyCategory: "RESIDENTIAL", propertyType: "DUPLEX", publicLocation: "Lekki, Lagos", fullAddress: "12 Private Street", askingPrice: 250000000, currentStep: "PROPERTY_INFORMATION" });
    expect(mocks.save).toHaveBeenCalledWith(propertyId, expect.objectContaining({ currentStep: "PHOTOS_DOCUMENTS" }));
  });

  it("uses a controlled property-type choice and autosaves through the canonical ID", async () => {
    const view = render(<SellerDraftEditor />, { wrapper });
    expect(screen.getByLabelText("Property Type")).toHaveRole("combobox");
    expect(screen.getByRole("option", { name: "Duplex" })).toHaveValue("DUPLEX");

    fireEvent.change(screen.getByLabelText("Property Title"), { target: { value: "3 bedroom" } });
    expect(screen.getByRole("heading", { name: "Tell us about the property" })).toBeVisible();
    expect(screen.queryByText("Loading listing…")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1), { timeout: 15000 });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(`/seller/listings/${propertyId}/edit`), { timeout: 15000 });
    expect(screen.getByRole("heading", { name: "Tell us about the property" })).toBeVisible();
    expect(screen.queryByText("Loading listing…")).not.toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("Description"), { target: { value: "A three bedroom property" } });
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(propertyId, expect.objectContaining({ description: "A three bedroom property" })), { timeout: 15000 });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it("hydrates an incomplete saved draft without immediate errors and validates only when advancing", async () => {
    mocks.restore.mockResolvedValueOnce({
      success: true,
      data: { property: { id: propertyId, currentStep: "PROPERTY_INFORMATION", publicLocation: "Custom Estate, Lagos", images: [], documents: [] } }
    });
    render(<SellerDraftEditor propertyId={propertyId} />, { wrapper });

    expect(await screen.findByLabelText("Location")).toHaveValue("Custom Estate, Lagos");
    expect(screen.queryByText("Enter a property title.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Enter a property title.")).toBeVisible();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("shows a safe field-specific message without leaking backend internals", async () => {
    mocks.create.mockRejectedValue(Object.assign(new Error("invalid input value for enum property_category"), { isAxiosError: true, response: { data: { success: false, message: "Validation failed", code: "INVALID_DRAFT_PAYLOAD", errors: { fieldErrors: { propertyType: ["Invalid enum value"] } } } } }));
    render(<SellerDraftEditor />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(await screen.findByText("Select a supported property type.")).toBeVisible();
    expect(screen.queryByText(/property_category|invalid input value/i)).not.toBeInTheDocument();
  });

  it("does not advance when the Step 1 persistence request fails", async () => {
    mocks.create.mockRejectedValue(Object.assign(new Error("storage failure"), { isAxiosError: true, response: { data: { success: false, message: "Property draft could not be saved", code: "DRAFT_PERSISTENCE_UNAVAILABLE" } } }));
    render(<SellerDraftEditor />, { wrapper });
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("We couldn’t save this property draft right now. Please try again.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Tell us about the property" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Add some photos of the property to show buyers" })).not.toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
