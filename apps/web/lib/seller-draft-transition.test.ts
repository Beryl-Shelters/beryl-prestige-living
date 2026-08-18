// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { continueSellerDraftToSalesMandate } from "./seller-draft-transition";

const propertyId = "11111111-1111-4111-8111-111111111111";

function deferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("continueSellerDraftToSalesMandate", () => {
  it("PATCHes the existing property with the exact Step 3 payload before navigating", async () => {
    const request = deferred();
    const saveExistingDraft = vi.fn(() => request.promise);
    const navigate = vi.fn();

    const transition = continueSellerDraftToSalesMandate(propertyId, saveExistingDraft, navigate);

    expect(saveExistingDraft).toHaveBeenCalledWith(propertyId, { currentStep: "SALES_MANDATE" });
    expect(navigate).not.toHaveBeenCalled();
    request.resolve();
    await transition;
    expect(navigate).toHaveBeenCalledWith(`/seller/listings/${propertyId}/edit?step=SALES_MANDATE`);
  });

  it("does not navigate when the existing-property PATCH fails", async () => {
    const saveExistingDraft = vi.fn().mockRejectedValue(new Error("network"));
    const navigate = vi.fn();

    await expect(continueSellerDraftToSalesMandate(propertyId, saveExistingDraft, navigate)).rejects.toThrow("network");
    expect(navigate).not.toHaveBeenCalled();
  });
});
