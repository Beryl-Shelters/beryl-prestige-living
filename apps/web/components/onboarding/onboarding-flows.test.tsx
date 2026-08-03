import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "@/test/render";
import { BuyerOnboardingScreen } from "./buyer-onboarding-screen";
import { SellerOnboardingScreen } from "./seller-onboarding-screen";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  buyer: vi.fn(),
  seller: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn(), back: vi.fn() })
}));

vi.mock("@/lib/api/client", () => ({
  customerApi: {
    buyerOnboarding: mocks.buyer,
    sellerOnboarding: mocks.seller
  }
}));

describe("customer onboarding screens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buyer.mockResolvedValue({ success: true, data: { nextAction: "OPEN_BUYER_DASHBOARD" } });
    mocks.seller.mockResolvedValue({ success: true, data: { nextAction: "OPEN_SELLER_DASHBOARD" } });
  });

  it("selects and removes a buyer location", async () => {
    renderWithQuery(<BuyerOnboardingScreen />);
    await userEvent.click(screen.getByRole("button", { name: /victoria island, lagos/i }));
    expect(screen.getByLabelText("Selected locations")).toHaveTextContent("Victoria Island, Lagos");
    await userEvent.click(screen.getByRole("button", { name: /remove victoria island/i }));
    expect(screen.queryByLabelText("Selected locations")).not.toBeInTheDocument();
  });

  it("validates that maximum buyer budget is not below minimum", async () => {
    renderWithQuery(<BuyerOnboardingScreen />);
    await userEvent.click(screen.getByRole("button", { name: /victoria island, lagos/i }));
    await userEvent.type(screen.getByLabelText("Minimum"), "50000000");
    await userEvent.type(screen.getByLabelText("Maximum"), "10000000");
    await userEvent.click(screen.getByRole("button", { name: /find a property/i }));
    expect(await screen.findByText(/maximum budget must be at least/i)).toBeInTheDocument();
  });

  it("submits buyer skip", async () => {
    renderWithQuery(<BuyerOnboardingScreen />);
    await userEvent.click(screen.getAllByRole("button", { name: /^skip$/i })[0]);
    await waitFor(() => expect(mocks.buyer.mock.calls[0]?.[0]).toEqual({ skip: true }));
    expect(mocks.replace).toHaveBeenCalledWith("/buyer");
  });

  it("submits an individual seller profile", async () => {
    renderWithQuery(<SellerOnboardingScreen />);
    await userEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    await waitFor(() => expect(mocks.seller.mock.calls[0]?.[0]).toEqual({ profileType: "INDIVIDUAL" }));
  });

  it("reveals and submits business fields", async () => {
    renderWithQuery(<SellerOnboardingScreen />);
    await userEvent.click(screen.getByRole("button", { name: /a business/i }));
    await userEvent.type(screen.getByLabelText(/company name/i), "Shelter Homes Limited");
    await userEvent.type(screen.getByLabelText(/company address/i), "1 Admiralty Way, Lagos");
    await userEvent.click(screen.getByRole("button", { name: /list as company/i }));
    await waitFor(() => expect(mocks.seller.mock.calls[0]?.[0]).toEqual({
      profileType: "BUSINESS",
      companyName: "Shelter Homes Limited",
      companyAddress: "1 Admiralty Way, Lagos"
    }));
  });

  it("submits seller skip", async () => {
    renderWithQuery(<SellerOnboardingScreen />);
    await userEvent.click(screen.getAllByRole("button", { name: /^skip$/i })[0]);
    await waitFor(() => expect(mocks.seller.mock.calls[0]?.[0]).toEqual({ skip: true }));
    expect(mocks.replace).toHaveBeenCalledWith("/seller");
  });
});
