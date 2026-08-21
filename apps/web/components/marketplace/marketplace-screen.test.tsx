import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "@/test/render";
import type { ApiSuccess, MarketplacePropertyCard, MarketplaceSearchResult } from "@/lib/contracts";

const mocks = vi.hoisted(() => ({ search: vi.fn(), replace: vi.fn(), save: vi.fn(), unsave: vi.fn(), session: null as null | { user: { id: string } } }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/lib/api/client", () => ({ marketplaceApi: { search: mocks.search }, customerApi: { saveProperty: mocks.save, unsaveProperty: mocks.unsave } }));
vi.mock("@/context/auth-provider", () => ({ useAuth: () => ({ session: mocks.session, sessionLoading: false }) }));
vi.mock("@/components/marketplace/marketplace-header", () => ({ MarketplaceHeader: ({ searchValue, onSearchChange, onSearchSubmit }: { searchValue: string; onSearchChange: (value: string) => void; onSearchSubmit: () => void }) => <form onSubmit={(event) => { event.preventDefault(); onSearchSubmit(); }}><label htmlFor="marketplace-search">Search properties</label><input id="marketplace-search" value={searchValue} onChange={(event) => onSearchChange(event.target.value)} /><button type="submit">Search</button></form> }));

import { MarketplaceScreen } from "./marketplace-screen";

const property: MarketplacePropertyCard = {
  id: "11111111-1111-4111-8111-111111111111",
  referenceId: "BRL-1001",
  title: "Modern four-bedroom duplex",
  askingPrice: 125000000,
  negotiable: true,
  propertyType: "DUPLEX",
  propertyCategory: "RESIDENTIAL",
  publicLocation: "Lekki Phase 1, Lagos",
  bedrooms: 4,
  bathrooms: 4,
  toilets: 5,
  parkingSpaces: 3,
  coverImage: { id: "image-id", url: "https://res.cloudinary.com/demo/image/upload/property.jpg" },
  photoCount: 8,
  verified: true,
  publishedAt: "2026-08-18T10:00:00.000Z",
  saved: false
};

const response = (properties = [property], page = 1, totalPages = 1): ApiSuccess<MarketplaceSearchResult> => ({
  success: true,
  message: "Marketplace properties fetched successfully",
  data: { properties, pagination: { page, limit: 12, total: properties.length || 0, total_pages: totalPages } }
});

describe("public Marketplace screen", () => {
  beforeEach(() => {
    mocks.search.mockReset().mockResolvedValue(response());
    mocks.replace.mockReset();
    mocks.save.mockReset().mockResolvedValue({ success: true, data: {} });
    mocks.unsave.mockReset().mockResolvedValue({ success: true });
    mocks.session = null;
  });

  it("renders publicly and performs the initial Marketplace fetch without auth context", async () => {
    renderWithQuery(<MarketplaceScreen />);
    expect(screen.getByRole("heading", { name: "Houses for Sale in Nigeria" })).toBeInTheDocument();
    await waitFor(() => expect(mocks.search).toHaveBeenCalledWith({ sort: "DEFAULT", page: 1, limit: 12 }));
  });

  it("maps trimmed search to q and resets page one", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MarketplaceScreen initialSearchParams={{ page: "3" }} />);
    await user.type(screen.getByLabelText("Search properties"), "  lekki ");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(mocks.search).toHaveBeenLastCalledWith(expect.objectContaining({ q: "lekki", page: 1 })));
    expect(mocks.replace).toHaveBeenLastCalledWith("/marketplace?q=lekki", { scroll: false });
  });

  it("maps location, price, multiple property-type checkboxes and an exact bedroom pill to API filters", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MarketplaceScreen initialSearchParams={{ category: "RESIDENTIAL" }} />);
    await user.type(screen.getByLabelText("Explore States"), "Lagos");
    await user.type(screen.getByLabelText("Minimum price"), "50000000");
    await user.type(screen.getByLabelText("Maximum price"), "200000000");
    expect(screen.getByLabelText("Minimum price")).toHaveValue("50,000,000");
    expect(screen.getByLabelText("Maximum price")).toHaveValue("200,000,000");
    await user.click(screen.getByRole("checkbox", { name: "Flat / apartment" }));
    await user.click(screen.getByRole("checkbox", { name: "Duplex" }));
    await user.click(screen.getByRole("button", { name: "4" }));
    await user.click(screen.getByRole("button", { name: "Apply Filters" }));
    await waitFor(() => expect(mocks.search).toHaveBeenLastCalledWith(expect.objectContaining({ location: "Lagos", minPrice: 50000000, maxPrice: 200000000, propertyType: "APARTMENT,DUPLEX", category: "RESIDENTIAL", bedrooms: 4, page: 1 })));
    expect(screen.getByRole("button", { name: "5+" })).toBeEnabled();
  });

  it("blocks an invalid client-side price range", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MarketplaceScreen />);
    await user.type(screen.getByLabelText("Minimum price"), "500");
    await user.type(screen.getByLabelText("Maximum price"), "100");
    await user.click(screen.getByRole("button", { name: "Apply Filters" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Minimum price cannot be greater");
    expect(mocks.search).toHaveBeenCalledTimes(1);
  });

  it("maps sort labels to the backend enum and resets pagination", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MarketplaceScreen initialSearchParams={{ page: "2" }} />);
    await user.selectOptions(screen.getByLabelText("Sort properties"), "PRICE_HIGH_TO_LOW");
    await waitFor(() => expect(mocks.search).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "PRICE_HIGH_TO_LOW", page: 1 })));
  });

  it("requests the selected result page", async () => {
    mocks.search.mockResolvedValue(response([property], 2, 4));
    const user = userEvent.setup();
    renderWithQuery(<MarketplaceScreen initialSearchParams={{ page: "2" }} />);
    await screen.findByText("Modern four-bedroom duplex");
    await user.click(within(screen.getByRole("navigation", { name: "Marketplace result pages" })).getByRole("button", { name: "3" }));
    await waitFor(() => expect(mocks.search).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 })));
    expect(mocks.replace).toHaveBeenLastCalledWith("/marketplace?page=3", { scroll: false });
  });

  it("renders the safe property-card DTO, cover, badges, metadata and W2 detail link", async () => {
    renderWithQuery(<MarketplaceScreen />);
    expect(await screen.findByText(property.title)).toHaveAttribute("href", `/marketplace/${property.id}`);
    expect(screen.getByAltText(`${property.title} in ${property.publicLocation}`)).toHaveAttribute("src", property.coverImage?.url);
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText(/125,000,000/)).toBeInTheDocument();
    expect(screen.getByText("Negotiable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Save ${property.title}` })).toBeEnabled();
  });

  it("maps condition, furnishing, and 5+ bedroom controls to API filters", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MarketplaceScreen />);
    await user.click(screen.getByRole("checkbox", { name: "Newly-Built" }));
    await user.click(screen.getByRole("checkbox", { name: "Off-Plan" }));
    await user.click(screen.getByRole("checkbox", { name: "Fully Furnished" }));
    await user.click(screen.getByRole("button", { name: "5+" }));
    await user.click(screen.getByRole("button", { name: "Apply Filters" }));
    await waitFor(() => expect(mocks.search).toHaveBeenLastCalledWith(expect.objectContaining({ condition: "NEWLY_BUILT,OFF_PLAN", furnishing: "FULLY_FURNISHED", bedrooms: "5+" })));
  });

  it("clears every applied filter without discarding the live Marketplace route", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MarketplaceScreen initialSearchParams={{ q: "Lekki", propertyType: "DUPLEX", condition: "NEWLY_BUILT", furnishing: "FULLY_FURNISHED", bedrooms: "5+" }} />);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(mocks.replace).toHaveBeenLastCalledWith("/marketplace", { scroll: false });
  });

  it("saves and unsaves from a result card for an authenticated customer", async () => {
    mocks.session = { user: { id: "customer-a" } };
    const user = userEvent.setup();
    renderWithQuery(<MarketplaceScreen />);
    await user.click(await screen.findByRole("button", { name: `Save ${property.title}` }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(property.id));
    await user.click(screen.getByRole("button", { name: `Remove ${property.title} from saved properties` }));
    await waitFor(() => expect(mocks.unsave).toHaveBeenCalledWith(property.id));
  });

  it("opens the existing account requirement for anonymous Save", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MarketplaceScreen />);
    await user.click(await screen.findByRole("button", { name: `Save ${property.title}` }));
    expect(screen.getByRole("heading", { name: "Set up a free account to continue" })).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("switches between the supplied grid and list result presentations", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MarketplaceScreen />);
    await screen.findByText(property.title);
    const results = screen.getByText(property.title).closest(".marketplace-grid");
    expect(results).toHaveClass("marketplace-grid");
    await user.click(screen.getByRole("button", { name: "List view" }));
    expect(results).toHaveClass("marketplace-list");
    expect(screen.getByText(property.title).closest("[data-view]")).toHaveAttribute("data-view", "list");
    expect(screen.getByText("Verified")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Grid view" }));
    expect(results).toHaveClass("marketplace-grid");
  });

  it("uses an intentional placeholder when the cover is null", async () => {
    mocks.search.mockResolvedValue(response([{ ...property, coverImage: null, photoCount: 0, verified: false }]));
    renderWithQuery(<MarketplaceScreen />);
    expect(await screen.findByText("Property image unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
  });

  it("shows stable card skeletons while loading", () => {
    mocks.search.mockReturnValue(new Promise(() => undefined));
    renderWithQuery(<MarketplaceScreen />);
    expect(screen.getByLabelText("Loading properties").children).toHaveLength(6);
  });

  it("shows a resettable empty state", async () => {
    mocks.search.mockResolvedValue(response([]));
    const user = userEvent.setup();
    renderWithQuery(<MarketplaceScreen initialSearchParams={{ q: "missing" }} />);
    expect(await screen.findByText("No properties match your search")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(mocks.replace).toHaveBeenLastCalledWith("/marketplace", { scroll: false });
  });

  it("shows a safe API error with retry", async () => {
    mocks.search.mockRejectedValueOnce(new Error("private stack details")).mockResolvedValueOnce(response());
    const user = userEvent.setup();
    renderWithQuery(<MarketplaceScreen />);
    expect(await screen.findByText("We could not load properties")).toBeInTheDocument();
    expect(screen.queryByText("private stack details")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText(property.title);
  });

  it("restores URL search state in the initial API request", async () => {
    renderWithQuery(<MarketplaceScreen initialSearchParams={{ q: "Ikoyi", location: "Lagos", minPrice: "100", propertyType: "APARTMENT", bedrooms: "2", sort: "MOST_RECENT", page: "2" }} />);
    await waitFor(() => expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ q: "Ikoyi", location: "Lagos", minPrice: 100, propertyType: "APARTMENT", bedrooms: 2, sort: "MOST_RECENT", page: 2 })));
  });

  it("opens and closes the accessible mobile filter dialog", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MarketplaceScreen />);
    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("dialog", { name: "Filter properties" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Filter properties" })).not.toBeInTheDocument();
  });
});
