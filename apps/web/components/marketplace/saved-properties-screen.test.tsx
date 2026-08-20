import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "@/test/render";

const mocks = vi.hoisted(() => ({ list: vi.fn(), unsave: vi.fn() }));
vi.mock("./marketplace-header", () => ({ MarketplaceHeader: () => <div>Marketplace header</div> }));
vi.mock("@/lib/api/client", () => ({ customerApi: { savedProperties: mocks.list, unsaveProperty: mocks.unsave } }));
import { SavedPropertiesScreen } from "./saved-properties-screen";

const property = { id: "11111111-1111-4111-8111-111111111111", referenceId: "BRL-1", title: "Lekki home", askingPrice: 100000000, negotiable: false, propertyType: "DUPLEX", propertyCategory: "RESIDENTIAL", publicLocation: "Lekki, Lagos", bedrooms: 4, bathrooms: 4, toilets: 5, parkingSpaces: 2, coverImage: null, photoCount: 0, verified: true, publishedAt: "2026-08-18T00:00:00.000Z", saved: true };
const response = (items: unknown[]) => ({ success: true, data: { saved_properties: items, pagination: { page: 1, limit: 50, total: items.length, total_pages: items.length ? 1 : 0 } } });

describe("Saved Properties screen", () => {
  beforeEach(() => { mocks.list.mockReset(); mocks.unsave.mockReset().mockResolvedValue({ success: true }); });

  it("renders Buyer-safe saved cards and links to detail", async () => {
    mocks.list.mockResolvedValue(response([{ id: "save-1", propertyId: property.id, savedAt: "2026-08-20T00:00:00.000Z", property }]));
    renderWithQuery(<SavedPropertiesScreen />);
    expect(await screen.findByRole("link", { name: "Lekki home" })).toHaveAttribute("href", `/marketplace/${property.id}`);
  });

  it("renders an empty saved state", async () => {
    mocks.list.mockResolvedValue(response([]));
    renderWithQuery(<SavedPropertiesScreen />);
    expect(await screen.findByText("No saved properties yet")).toBeInTheDocument();
  });

  it("unsaves from the Saved screen", async () => {
    mocks.list.mockResolvedValue(response([{ id: "save-1", propertyId: property.id, savedAt: "2026-08-20T00:00:00.000Z", property }]));
    renderWithQuery(<SavedPropertiesScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Remove Lekki home from saved properties" }));
    await waitFor(() => expect(mocks.unsave).toHaveBeenCalledWith(property.id));
  });
});
