import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "@/test/render";
import type { ApiSuccess, CustomerSessionState, MarketplacePropertyDetail, MarketplacePropertyDetailResult } from "@/lib/contracts";

const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  save: vi.fn(),
  unsave: vi.fn(),
  interest: vi.fn(),
  auth: { session: null as CustomerSessionState | null, sessionLoading: false }
}));

vi.mock("@/context/auth-provider", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/components/marketplace/marketplace-header", () => ({ MarketplaceHeader: () => null }));
vi.mock("@/lib/api/client", () => ({
  marketplaceApi: { detail: mocks.detail },
  customerApi: { saveProperty: mocks.save, unsaveProperty: mocks.unsave, expressMarketplaceInterest: mocks.interest }
}));

import { MarketplacePropertyDetailScreen } from "./property-detail-screen";

const id = "11111111-1111-4111-8111-111111111111";
const property: MarketplacePropertyDetail = {
  id,
  referenceId: "BRL-1001",
  title: "Modern four-bedroom duplex",
  description: "A comfortable home in a well-connected location.",
  askingPrice: 125000000,
  negotiable: true,
  propertyType: "DUPLEX",
  propertyCategory: "RESIDENTIAL",
  publicLocation: "Lekki Phase 1, Lagos",
  bedrooms: 4,
  bathrooms: 4,
  toilets: 5,
  parkingSpaces: 3,
  numberOfFloors: 2,
  parkingCapacity: 3,
  condition: "NEWLY_BUILT",
  furnishing: "FURNISHED",
  initialDeposit: { type: "PERCENTAGE", value: 20 },
  amenities: ["Security", "Swimming pool"],
  images: [
    { id: "secondary", url: "https://res.cloudinary.com/demo/image/upload/secondary.jpg", order: 1, isCover: false },
    { id: "cover", url: "https://res.cloudinary.com/demo/image/upload/cover.jpg", order: 0, isCover: true }
  ],
  photoCount: 2,
  verified: true,
  publishedAt: "2026-08-18T10:00:00.000Z",
  saved: false
};
const response = (value = property): ApiSuccess<MarketplacePropertyDetailResult> => ({ success: true, message: "Property found", data: { property: value } });
const session: CustomerSessionState = {
  user: { id: "customer-id", fullName: "Test Customer", email: "customer@example.com", phone: "+2348012345678", accountStatus: "ACTIVE", emailVerified: true },
  activePersona: "BUYER",
  personas: [{ type: "BUYER", onboardingStatus: "COMPLETED" }],
  nextAction: "OPEN_BUYER_DASHBOARD"
};

describe("Marketplace property detail", () => {
  beforeEach(() => {
    mocks.auth.session = null;
    mocks.auth.sessionLoading = false;
    mocks.detail.mockReset().mockResolvedValue(response());
    mocks.save.mockReset().mockResolvedValue({ success: true, data: { saved_property: { id: "saved-id", propertyId: id, savedAt: "2026-08-18T10:00:00.000Z" } } });
    mocks.unsave.mockReset().mockResolvedValue({ success: true, data: undefined });
    mocks.interest.mockReset().mockResolvedValue({ success: true, data: { inquiryId: "interest-id", propertyId: id, referenceId: "BRL-1001", title: property.title, askingPrice: property.askingPrice, preferredContactMethod: "WHATSAPP", submittedAt: "2026-08-18T10:00:00.000Z", nextAction: "KEEP_BROWSING" } });
  });

  it("renders public LIVE-safe detail data and asks for the requested property", async () => {
    renderWithQuery(<MarketplacePropertyDetailScreen propertyId={id} />);
    expect(await screen.findByRole("heading", { name: property.title })).toBeInTheDocument();
    expect(mocks.detail).toHaveBeenCalledWith(id);
    expect(screen.getByText("Lekki Phase 1, Lagos")).toBeInTheDocument();
    expect(screen.getByText(/125,000,000/)).toBeInTheDocument();
    expect(screen.getByText("Verified by Beryl")).toBeInTheDocument();
    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(screen.queryByText(/full address/i)).not.toBeInTheDocument();
  });

  it("uses cover-first ordered gallery controls and an intentional empty gallery", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MarketplacePropertyDetailScreen propertyId={id} />);
    await screen.findByRole("heading", { name: property.title });
    expect(screen.getByRole("img", { name: `${property.title}, image 1` })).toHaveAttribute("src", property.images[1].url);
    await user.click(screen.getByRole("button", { name: "Show image 2" }));
    expect(screen.getByRole("img", { name: `${property.title}, image 2` })).toHaveAttribute("src", property.images[0].url);

    mocks.detail.mockResolvedValueOnce(response({ ...property, images: [], photoCount: 0 }));
    renderWithQuery(<MarketplacePropertyDetailScreen propertyId="22222222-2222-4222-8222-222222222222" />);
    expect(await screen.findByText("Property images are not available")).toBeInTheDocument();
  });

  it("shows the accessible authentication prompt for anonymous Save and interest", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MarketplacePropertyDetailScreen propertyId={id} />);
    await screen.findByRole("heading", { name: property.title });
    await user.click(screen.getAllByRole("button", { name: "Save property" }).at(-1)!);
    expect(screen.getByRole("dialog", { name: "Set up a free account to continue" })).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Close sign in prompt" }));
    await user.click(screen.getByRole("button", { name: "Send Interest" }));
    expect(screen.getByRole("dialog", { name: "Set up a free account to continue" })).toBeInTheDocument();
    expect(mocks.interest).not.toHaveBeenCalled();
  });

  it("persists authenticated save/unsave once and updates the detail state", async () => {
    const user = userEvent.setup();
    mocks.auth.session = session;
    renderWithQuery(<MarketplacePropertyDetailScreen propertyId={id} />);
    await screen.findByRole("heading", { name: property.title });
    const saveButton = screen.getAllByRole("button", { name: "Save property" }).at(-1)!;
    await user.click(saveButton);
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(id));
    expect(await screen.findByRole("button", { name: "Remove saved property" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Remove saved property" }));
    await waitFor(() => expect(mocks.unsave).toHaveBeenCalledWith(id));
  });

  it("opens Express Interest for authenticated customers and sends the selected method with trimmed message", async () => {
    const user = userEvent.setup();
    mocks.auth.session = session;
    renderWithQuery(<MarketplacePropertyDetailScreen propertyId={id} />);
    await screen.findByRole("heading", { name: property.title });
    await user.click(screen.getByRole("radio", { name: /Email/i }));
    await user.type(screen.getByRole("textbox", { name: /Anything you'd like to ask/i }), "  Please share available viewing times.  ");
    await user.click(screen.getByRole("button", { name: "Send Interest" }));
    await waitFor(() => expect(mocks.interest).toHaveBeenCalledWith(id, { preferredContactMethod: "EMAIL", message: "Please share available viewing times." }));
    expect(await screen.findByRole("heading", { name: "Interest Sent" })).toBeInTheDocument();
    expect(screen.getByText("Preferred contact: Email")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What happens next?" })).toBeInTheDocument();
  });

  it("does not submit an invalid contact method and renders safe backend errors", async () => {
    const user = userEvent.setup();
    mocks.auth.session = session;
    mocks.interest.mockRejectedValueOnce(Object.assign(new Error("unavailable"), { isAxiosError: true, response: { data: { code: "CONTACT_METHOD_UNAVAILABLE" } } }));
    renderWithQuery(<MarketplacePropertyDetailScreen propertyId={id} />);
    await screen.findByRole("heading", { name: property.title });
    await user.click(screen.getByRole("button", { name: "Send Interest" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose how you would like to be contacted.");
    expect(mocks.interest).not.toHaveBeenCalled();
    await user.click(screen.getByRole("radio", { name: /Call/i }));
    await user.click(screen.getByRole("button", { name: "Send Interest" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That contact method is not available");
  });

  it("renders a safe unavailable state and keeps the responsive detail structure", async () => {
    mocks.detail.mockRejectedValueOnce(new Error("private backend failure"));
    renderWithQuery(<MarketplacePropertyDetailScreen propertyId={id} />);
    expect(await screen.findByRole("heading", { name: "Property unavailable" })).toBeInTheDocument();
    expect(screen.queryByText("private backend failure")).not.toBeInTheDocument();
  });
});
