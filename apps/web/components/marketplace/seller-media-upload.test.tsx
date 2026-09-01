import { readFileSync } from "node:fs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SellerDraftEditor } from "./seller-draft-editor";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  sellerDraft: vi.fn(),
  sellerListingManagement: vi.fn(),
  saveSellerDraft: vi.fn(),
  uploadSellerImages: vi.fn(),
  uploadSellerDocument: vi.fn(),
  reorderSellerImages: vi.fn(),
  setSellerCover: vi.fn(),
  deleteSellerImage: vi.fn(),
  deleteSellerDocument: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace })
}));

vi.mock("@/lib/api/client", () => ({
  customerApi: {
    sellerDraft: mocks.sellerDraft,
    sellerListingManagement: mocks.sellerListingManagement,
    saveSellerDraft: mocks.saveSellerDraft,
    uploadSellerImages: mocks.uploadSellerImages,
    uploadSellerDocument: mocks.uploadSellerDocument,
    reorderSellerImages: mocks.reorderSellerImages,
    setSellerCover: mocks.setSellerCover,
    deleteSellerImage: mocks.deleteSellerImage,
    deleteSellerDocument: mocks.deleteSellerDocument,
    createSellerDraft: vi.fn(),
    deleteSellerDraft: vi.fn()
  }
}));

const propertyId = "11111111-1111-4111-8111-111111111111";
const images = [
  { id: "image-1", url: "https://example.com/one.jpg", order: 0, isCover: true },
  { id: "image-2", url: "https://example.com/two.jpg", order: 1, isCover: false }
];
const document = { id: "document-1", documentType: "DEED", displayName: "deed.pdf", mimeType: "application/pdf", sizeBytes: 12, uploadedAt: "2026-09-01T12:00:00.000Z" };

const response = (nextImages = images, documents: typeof document[] = []) => ({
  success: true,
  data: { property: { id: propertyId, currentStep: "PHOTOS_DOCUMENTS", images: nextImages, documents } }
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function sizedFile(name: string, type: string, size?: number) {
  const file = new File(["content"], name, { type });
  if (size !== undefined) Object.defineProperty(file, "size", { value: size });
  return file;
}

async function renderMedia(initial = response()) {
  mocks.sellerDraft.mockResolvedValueOnce(initial);
  render(<SellerDraftEditor propertyId={propertyId} initialStep="PHOTOS_DOCUMENTS" />, { wrapper });
  await screen.findByRole("heading", { name: "Add some photos of the property to show buyers" });
}

describe("Seller media upload operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sellerListingManagement.mockResolvedValue({ success: true, data: { management: { summary: { status: "DRAFT" } } } });
    mocks.saveSellerDraft.mockResolvedValue({ success: true });
  });

  it("shows scoped multi-photo pending feedback, prevents conflicts, and refetches authoritative images without reloading", async () => {
    const upload = deferred();
    const uploadedImages = [...images, { id: "image-3", url: "https://example.com/three.jpg", order: 2, isCover: false }];
    mocks.uploadSellerImages.mockReturnValue(upload.promise);
    mocks.sellerDraft.mockResolvedValueOnce(response()).mockResolvedValueOnce(response(uploadedImages));
    render(<SellerDraftEditor propertyId={propertyId} initialStep="PHOTOS_DOCUMENTS" />, { wrapper });

    const photoInput = await screen.findByLabelText(/Add Photos/);
    const selected = [sizedFile("one.jpg", "image/jpeg"), sizedFile("two.webp", "image/webp")];
    fireEvent.change(photoInput, { target: { files: selected } });

    expect(await screen.findByRole("status", { name: "Uploading 2 photos…" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save as draft" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(photoInput).toBeDisabled();
    expect(screen.getByLabelText(/Upload supporting document/)).toBeDisabled();
    fireEvent.change(photoInput, { target: { files: selected } });
    expect(mocks.uploadSellerImages).toHaveBeenCalledTimes(1);

    upload.resolve({ success: true });
    expect(await screen.findByAltText("Property photo 3")).toBeVisible();
    await waitFor(() => expect(screen.queryByRole("status", { name: "Uploading 2 photos…" })).not.toBeInTheDocument());
    expect(mocks.sellerDraft).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(photoInput).toHaveValue("");
  });

  it("shows document pending feedback and replaces it with the authoritative document list after success", async () => {
    const upload = deferred();
    mocks.uploadSellerDocument.mockReturnValue(upload.promise);
    mocks.sellerDraft.mockResolvedValueOnce(response()).mockResolvedValueOnce(response(images, [document]));
    render(<SellerDraftEditor propertyId={propertyId} initialStep="PHOTOS_DOCUMENTS" />, { wrapper });

    const input = await screen.findByLabelText(/Upload supporting document/);
    fireEvent.change(input, { target: { files: [sizedFile("deed.pdf", "application/pdf")] } });
    expect(await screen.findByRole("status", { name: "Uploading document…" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    upload.resolve({ success: true });
    expect(await screen.findByText("deed.pdf")).toBeVisible();
    await waitFor(() => expect(screen.queryByRole("status", { name: "Uploading document…" })).not.toBeInTheDocument());
    expect(mocks.sellerDraft).toHaveBeenCalledTimes(2);
    expect(input).toHaveValue("");
  });

  it("clears failed photo state, preserves media, and allows the exact same image to be retried", async () => {
    mocks.uploadSellerImages.mockRejectedValueOnce(new Error("provider unavailable")).mockResolvedValueOnce({ success: true });
    mocks.sellerDraft.mockResolvedValueOnce(response()).mockResolvedValueOnce(response());
    render(<SellerDraftEditor propertyId={propertyId} initialStep="PHOTOS_DOCUMENTS" />, { wrapper });
    const input = await screen.findByLabelText(/Add Photos/);
    const file = sizedFile("same.jpg", "image/jpeg");

    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText("Image upload failed. Please try again.")).toBeVisible();
    expect(input).toHaveValue("");
    expect(screen.getByAltText("Property photo 1")).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();

    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(mocks.uploadSellerImages).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled());
  });

  it("clears failed document state and allows the exact same PDF to be retried", async () => {
    mocks.uploadSellerDocument.mockRejectedValueOnce(new Error("provider unavailable")).mockResolvedValueOnce({ success: true });
    mocks.sellerDraft.mockResolvedValueOnce(response()).mockResolvedValueOnce(response(images, [document]));
    render(<SellerDraftEditor propertyId={propertyId} initialStep="PHOTOS_DOCUMENTS" />, { wrapper });
    const input = await screen.findByLabelText(/Upload supporting document/);
    const file = sizedFile("same.pdf", "application/pdf");

    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText("Document upload failed. Please try again.")).toBeVisible();
    expect(input).toHaveValue("");
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(mocks.uploadSellerDocument).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("deed.pdf")).toBeVisible();
  });

  it("does not count a pending photo and uses the persisted refetched photo for Step 2 validation", async () => {
    const upload = deferred();
    const persistedImage = [{ id: "persisted-image", url: "https://example.com/persisted.jpg", order: 0, isCover: true }];
    mocks.uploadSellerImages.mockReturnValue(upload.promise);
    mocks.sellerDraft.mockResolvedValueOnce(response([])).mockResolvedValueOnce(response(persistedImage));
    render(<SellerDraftEditor propertyId={propertyId} initialStep="PHOTOS_DOCUMENTS" />, { wrapper });
    const input = await screen.findByLabelText(/Add Photos/);

    fireEvent.change(input, { target: { files: [sizedFile("persisted.jpg", "image/jpeg")] } });
    expect(await screen.findByRole("status", { name: "Uploading photo…" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(mocks.saveSellerDraft).not.toHaveBeenCalled();

    upload.resolve({ success: true });
    expect(await screen.findByAltText("Property photo 1")).toBeVisible();
    const continueButton = await screen.findByRole("button", { name: "Continue" });
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);
    await waitFor(() => expect(mocks.saveSellerDraft).toHaveBeenCalledWith(propertyId, { currentStep: "SALES_MANDATE" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/seller/listings/${propertyId}/edit?step=SALES_MANDATE`));
  });

  it.each([
    ["reorder", "Move left", mocks.reorderSellerImages, "We could not reorder photos. Please try again."],
    ["cover", "Set as cover", mocks.setSellerCover, "We could not update the cover photo. Please try again."],
    ["image delete", "Delete", mocks.deleteSellerImage, "We could not delete this photo. Please try again."],
    ["document delete", "Delete deed.pdf", mocks.deleteSellerDocument, "We could not delete this document. Please try again."]
  ])("restores controls when %s fails", async (_operation, buttonName, request, message) => {
    request.mockRejectedValueOnce(new Error("network"));
    await renderMedia(response(images, [document]));
    const buttons = screen.getAllByRole("button", { name: buttonName });
    fireEvent.click(buttons.at(-1)!);
    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save as draft" })).toBeEnabled();
  });

  it("preserves image, document, size, and total-photo validation rules", async () => {
    const nineImages = Array.from({ length: 9 }, (_, index) => ({ id: `image-${index}`, url: `https://example.com/${index}.jpg`, order: index, isCover: index === 0 }));
    await renderMedia(response(nineImages));
    const photoInput = screen.getByLabelText(/Add Photos/);
    const documentInput = screen.getByLabelText(/Upload supporting document/);

    fireEvent.change(photoInput, { target: { files: [sizedFile("bad.gif", "image/gif")] } });
    expect(await screen.findByText("Use up to ten JPEG, PNG, or WEBP images, each up to 5MB.")).toBeVisible();
    fireEvent.change(photoInput, { target: { files: [sizedFile("large.jpg", "image/jpeg", 5 * 1024 * 1024 + 1)] } });
    fireEvent.change(photoInput, { target: { files: [sizedFile("a.jpg", "image/jpeg"), sizedFile("b.jpg", "image/jpeg")] } });
    fireEvent.change(documentInput, { target: { files: [sizedFile("bad.txt", "text/plain")] } });
    expect(await screen.findByText("Use a PDF up to 10MB.")).toBeVisible();
    fireEvent.change(documentInput, { target: { files: [sizedFile("large.pdf", "application/pdf", 10 * 1024 * 1024 + 1)] } });
    expect(mocks.uploadSellerImages).not.toHaveBeenCalled();
    expect(mocks.uploadSellerDocument).not.toHaveBeenCalled();
    expect(photoInput).toHaveValue("");
    expect(documentInput).toHaveValue("");
  });

  it("does not use a page reload in the media implementation", () => {
    const source = readFileSync("components/marketplace/seller-draft-editor.tsx", "utf8");
    expect(source).not.toContain("location.reload");
    expect(source).not.toContain("window.location.reload");
  });
});
