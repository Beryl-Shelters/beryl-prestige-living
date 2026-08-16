import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "@/test/render";
import { BuyerOnboardingScreen } from "./buyer-onboarding-screen";
import { SellerOnboardingScreen } from "./seller-onboarding-screen";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  buyer: vi.fn(),
  seller: vi.fn(),
  track: vi.fn()
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
vi.mock("@/lib/analytics/customer", () => ({
  trackCustomerEvent: mocks.track,
  customerPersonaForAnalytics: (persona: "BUYER" | "SELLER_DEVELOPER") => persona === "BUYER" ? "Buyer" : "Seller-Developer"
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

  it("hides the location search icon while typing and restores it when empty", async () => {
    renderWithQuery(<BuyerOnboardingScreen />);
    const search = screen.getByRole("combobox", { name: /select your preferred location/i });
    expect(screen.getByTestId("location-search-icon")).toBeInTheDocument();
    await userEvent.type(search, "Ikeja");
    expect(screen.queryByTestId("location-search-icon")).not.toBeInTheDocument();
    await userEvent.clear(search);
    expect(screen.getByTestId("location-search-icon")).toBeInTheDocument();
  });

  it("updates both budget prefixes when the selected currency changes", async () => {
    const { container } = renderWithQuery(<BuyerOnboardingScreen />);
    const prefixes = () => Array.from(container.querySelectorAll(".input-prefix"), (prefix) => prefix.textContent);
    expect(prefixes()).toEqual(["₦", "₦"]);
    await userEvent.selectOptions(screen.getByLabelText("Currency"), "USD");
    expect(prefixes()).toEqual(["$", "$"]);
    await userEvent.type(screen.getByLabelText("Minimum"), "5000000");
    await userEvent.type(screen.getByLabelText("Maximum"), "10000000");
    expect(screen.getByLabelText("Minimum")).toHaveValue("5,000,000");
    expect(screen.getByLabelText("Maximum")).toHaveValue("10,000,000");
  });

  it("validates that maximum buyer budget is not below minimum", async () => {
    renderWithQuery(<BuyerOnboardingScreen />);
    await userEvent.click(screen.getByRole("button", { name: /victoria island, lagos/i }));
    await userEvent.type(screen.getByLabelText("Minimum"), "50000000");
    await userEvent.type(screen.getByLabelText("Maximum"), "10000000");
    await userEvent.click(screen.getByRole("button", { name: /find a property/i }));
    expect(await screen.findByText(/maximum budget must be at least/i)).toBeInTheDocument();
    expect(mocks.track).not.toHaveBeenCalledWith("Buyer Onboarding Completed", expect.anything());
  });

  it("submits buyer skip", async () => {
    renderWithQuery(<BuyerOnboardingScreen />);
    await userEvent.click(screen.getAllByRole("button", { name: /^skip$/i })[0]);
    await waitFor(() => expect(mocks.buyer.mock.calls[0]?.[0]).toEqual({ skip: true }));
    expect(mocks.replace).toHaveBeenCalledWith("/buyer");
    expect(mocks.track).not.toHaveBeenCalledWith("Buyer Onboarding Completed", expect.anything());
  });

  it("tracks buyer completion at the valid client action, before backend confirmation, once", async () => {
    let resolveRequest!: () => void;
    mocks.buyer.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveRequest = resolve; }));
    renderWithQuery(<BuyerOnboardingScreen />);
    await userEvent.click(screen.getByRole("button", { name: /victoria island, lagos/i }));
    await userEvent.type(screen.getByLabelText("Minimum"), "5000000");
    await userEvent.click(screen.getByRole("button", { name: /find a property/i }));
    await waitFor(() => expect(mocks.track).toHaveBeenCalledWith("Buyer Onboarding Completed", { preferred_locations: ["Victoria Island, Lagos"], budget_provided: true, skipped_budget: false }));
    expect(mocks.replace).not.toHaveBeenCalled();
    resolveRequest();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/buyer"));
    expect(mocks.track).toHaveBeenCalledTimes(1);
  });

  it("submits an individual seller profile", async () => {
    renderWithQuery(<SellerOnboardingScreen />);
    await userEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    await waitFor(() => expect(mocks.seller.mock.calls[0]?.[0]).toEqual({ profileType: "INDIVIDUAL" }));
  });

  it("does not track an invalid seller completion submission", async () => {
    renderWithQuery(<SellerOnboardingScreen />);
    await userEvent.click(screen.getByRole("button", { name: /a business/i }));
    await userEvent.click(screen.getByRole("button", { name: /list as company/i }));
    expect(await screen.findByText(/enter your company name/i)).toBeInTheDocument();
    expect(mocks.track).not.toHaveBeenCalledWith("Seller Onboarding Completed", expect.anything());
  });

  it("tracks seller completion at the valid client action, before backend confirmation, once", async () => {
    let resolveRequest!: () => void;
    mocks.seller.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveRequest = resolve; }));
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
    expect(mocks.track).toHaveBeenCalledWith("Seller Onboarding Completed", { profile_type: "Business", company_name_provided: true, company_address_provided: true });
    expect(mocks.replace).not.toHaveBeenCalled();
    resolveRequest();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/seller"));
    expect(mocks.track).toHaveBeenCalledTimes(1);
  });

  it("submits seller skip", async () => {
    renderWithQuery(<SellerOnboardingScreen />);
    await userEvent.click(screen.getAllByRole("button", { name: /^skip$/i })[0]);
    await waitFor(() => expect(mocks.seller.mock.calls[0]?.[0]).toEqual({ skip: true }));
    expect(mocks.replace).toHaveBeenCalledWith("/seller");
  });
});
