import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "@/test/render";
import { PersonaSwitcher } from "./persona-switcher";

const mocks = vi.hoisted(() => ({ push: vi.fn(), activate: vi.fn(), switchPersona: vi.fn(), close: vi.fn(), track: vi.fn(), updatePersona: vi.fn(), prepare: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/api/client", () => ({ customerApi: {
  personas: vi.fn().mockResolvedValue({ success: true, data: { activePersona: "BUYER", personas: [
    { type: "BUYER", onboardingStatus: "COMPLETED", activated: true },
    { type: "SELLER_DEVELOPER", onboardingStatus: "NOT_STARTED", activated: false }
  ] } }),
  activatePersona: (...args: unknown[]) => mocks.activate(...args),
  switchPersona: (...args: unknown[]) => mocks.switchPersona(...args)
} }));
vi.mock("@/lib/analytics/customer", () => ({
  customerPersonaForAnalytics: (persona: "BUYER" | "SELLER_DEVELOPER") => persona === "BUYER" ? "Buyer" : "Seller-Developer",
  trackCustomerEvent: mocks.track,
  updateCustomerAnalyticsPersona: mocks.updatePersona
}));
vi.mock("@/lib/analytics/onboarding-trigger", () => ({ prepareOnboardingAnalyticsTrigger: mocks.prepare }));

describe("PersonaSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activate.mockResolvedValue({ success: true, data: { activePersona: "SELLER_DEVELOPER", nextAction: "COMPLETE_SELLER_ONBOARDING" } });
    mocks.switchPersona.mockResolvedValue({ success: true, data: { activePersona: "SELLER_DEVELOPER", nextAction: "OPEN_SELLER_DASHBOARD" } });
  });

  it("activates an unactivated persona and routes to onboarding", async () => {
    renderWithQuery(<PersonaSwitcher open onClose={mocks.close} />);
    await userEvent.click(await screen.findByRole("button", { name: /activate/i }));
    await waitFor(() => expect(mocks.activate.mock.calls[0]?.[0]).toBe("SELLER_DEVELOPER"));
    expect(mocks.push).toHaveBeenCalledWith("/onboarding/seller");
    expect(mocks.track).toHaveBeenCalledWith("Persona Activation Started", { target_persona: "Seller-Developer" });
  });

  it("switches an already activated inactive persona", async () => {
    const client = await import("@/lib/api/client");
    vi.mocked(client.customerApi.personas).mockResolvedValueOnce({ success: true, message: "ok", data: { activePersona: "BUYER", personas: [
      { type: "BUYER", onboardingStatus: "COMPLETED", activated: true },
      { type: "SELLER_DEVELOPER", onboardingStatus: "COMPLETED", activated: true }
    ] } });
    renderWithQuery(<PersonaSwitcher open onClose={mocks.close} />);
    await userEvent.click(await screen.findByRole("button", { name: /^switch$/i }));
    await waitFor(() => expect(mocks.switchPersona.mock.calls[0]?.[0]).toBe("SELLER_DEVELOPER"));
    expect(mocks.push).toHaveBeenCalledWith("/seller/listings");
    expect(mocks.track).toHaveBeenCalledWith("Persona Switched", { from_persona: "Buyer", to_persona: "Seller-Developer" });
  });

  it("closes with Escape", async () => {
    renderWithQuery(<PersonaSwitcher open onClose={mocks.close} />);
    await userEvent.keyboard("{Escape}");
    expect(mocks.close).toHaveBeenCalled();
  });
});
