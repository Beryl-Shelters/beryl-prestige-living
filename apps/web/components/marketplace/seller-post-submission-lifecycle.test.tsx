import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SellerSubmissionResult } from "@/lib/contracts";
import { SellerDraftEditor } from "./seller-draft-editor";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  sellerDraft: vi.fn(),
  sellerListingManagement: vi.fn()
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: mocks.replace }) }));
vi.mock("@/lib/api/client", () => ({ customerApi: {
  sellerDraft: mocks.sellerDraft,
  sellerListingManagement: mocks.sellerListingManagement
} }));
vi.mock("./seller-review-step", () => ({
  SellerReviewStep: ({ onSubmitted }: { onSubmitted?: (submission: SellerSubmissionResult) => void }) => (
    <button type="button" onClick={() => onSubmitted?.({
      propertyId,
      referenceId: "BRL-1001",
      status: "IN_REVIEW",
      submittedAt: "2026-08-20T12:00:00.000Z",
      nextAction: "OPEN_MY_LISTINGS"
    })}>Complete submission</button>
  ),
  SellerSubmissionSuccess: ({ submission }: { submission: SellerSubmissionResult }) => (
    <section><h2>Submitted successfully</h2><p>{submission.referenceId}</p><p>{submission.status}</p><Link href="/seller/listings">Open My Listings</Link></section>
  )
}));

const propertyId = "11111111-1111-4111-8111-111111111111";
const draftResponse = { success: true, data: { property: {
  id: propertyId,
  title: "Four bedroom home",
  currentStep: "REVIEW",
  images: [],
  documents: []
} } };
const summary = (status: "DRAFT" | "IN_REVIEW") => ({
  id: propertyId,
  status,
  nextAction: status === "DRAFT" ? "CONTINUE_REVIEW" : "VIEW_REVIEW_STATUS",
  rejectionFeedback: null,
  rejectionReason: null
});
const managementResponse = (status: "DRAFT" | "IN_REVIEW") => ({ success: true, data: { management: { summary: summary(status) } } });
const apiNotFound = () => Object.assign(new Error("not found"), {
  isAxiosError: true,
  response: { status: 404, data: { success: false, code: "PROPERTY_NOT_FOUND", message: "Property draft not found" } }
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

describe("Seller post-submission editor lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sellerDraft.mockResolvedValue(draftResponse);
    mocks.sellerListingManagement.mockResolvedValue(managementResponse("DRAFT"));
  });

  it("freezes the editor on its IN_REVIEW success state without refetching the draft", async () => {
    render(<SellerDraftEditor propertyId={propertyId} initialStep="REVIEW" />, { wrapper });
    fireEvent.click(await screen.findByRole("button", { name: "Complete submission" }));

    expect(await screen.findByRole("heading", { name: "Submitted successfully" })).toBeVisible();
    expect(screen.getByText("BRL-1001")).toBeVisible();
    expect(screen.getByText("IN_REVIEW")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open My Listings" })).toHaveAttribute("href", "/seller/listings");
    expect(mocks.sellerDraft).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Complete submission" })).not.toBeInTheDocument();
  });

  it("routes an already submitted old edit URL to its management destination", async () => {
    mocks.sellerDraft.mockRejectedValue(apiNotFound());
    mocks.sellerListingManagement.mockResolvedValue(managementResponse("IN_REVIEW"));
    render(<SellerDraftEditor propertyId={propertyId} initialStep="REVIEW" />, { wrapper });

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(`/seller/listings/${propertyId}`));
    expect(screen.queryByText(/restore this draft/i)).not.toBeInTheDocument();
    expect(screen.getByText("Opening listing status…")).toBeVisible();
  });

  it("keeps a safe not-found state for a genuinely missing property", async () => {
    mocks.sellerDraft.mockRejectedValue(apiNotFound());
    mocks.sellerListingManagement.mockRejectedValue(apiNotFound());
    render(<SellerDraftEditor propertyId={propertyId} />, { wrapper });

    expect(await screen.findByText("This property could not be found.")).toBeVisible();
    expect(screen.queryByText(/restore this draft/i)).not.toBeInTheDocument();
  });

  it("uses the official branded status during initial hydration", () => {
    mocks.sellerDraft.mockReturnValue(new Promise(() => undefined));
    mocks.sellerListingManagement.mockReturnValue(new Promise(() => undefined));
    const { container } = render(<SellerDraftEditor propertyId={propertyId} />, { wrapper });

    expect(screen.getByRole("status")).toHaveTextContent("Loading listing…");
    expect(screen.getByText("Beryl Shelter")).toBeVisible();
    expect(container.querySelector("img")).toHaveAttribute("src", expect.stringContaining("android-chrome-192x192.png"));
    expect(container.querySelector(".spinner")).not.toBeInTheDocument();
  });
});
