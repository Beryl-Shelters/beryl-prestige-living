import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "@/test/render";
import { PersonaSwitcher } from "./persona-switcher";
import { customerApi } from "@/lib/api/client";

const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), activate: vi.fn(), switchPersona: vi.fn(), close: vi.fn(), logout: vi.fn(), track: vi.fn(), updatePersona: vi.fn(), prepare: vi.fn(), refreshSession: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace, refresh: mocks.refresh }) }));
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
vi.mock("@/context/auth-provider", () => ({ useAuth: () => ({ session: null, refreshSession: mocks.refreshSession, logout: mocks.logout, logoutPending: false }) }));

describe("PersonaSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(customerApi.personas).mockReset().mockResolvedValue({ success: true, message: "ok", data: { activePersona: "BUYER", personas: [
      { type: "BUYER", onboardingStatus: "COMPLETED", activated: true },
      { type: "SELLER_DEVELOPER", onboardingStatus: "NOT_STARTED", activated: false }
    ] } });
    mocks.activate.mockResolvedValue({ success: true, data: { activePersona: "SELLER_DEVELOPER", nextAction: "COMPLETE_SELLER_ONBOARDING" } });
    mocks.switchPersona.mockResolvedValue({ success: true, data: { activePersona: "SELLER_DEVELOPER", nextAction: "OPEN_SELLER_DASHBOARD" } });
    mocks.refreshSession.mockResolvedValue({ activePersona: "SELLER_DEVELOPER", personas: [{ type: "SELLER_DEVELOPER", onboardingStatus: "NOT_STARTED" }], nextAction: "COMPLETE_SELLER_ONBOARDING" });
    mocks.logout.mockResolvedValue(undefined);
  });

  it("activates an unactivated persona and routes to onboarding", async () => {
    renderWithQuery(<PersonaSwitcher open onClose={mocks.close} />);
    await userEvent.click(await screen.findByRole("button", { name: /activate/i }));
    await waitFor(() => expect(mocks.activate.mock.calls[0]?.[0]).toBe("SELLER_DEVELOPER"));
    expect(mocks.push).toHaveBeenCalledWith("/onboarding/seller");
    expect(mocks.refreshSession).toHaveBeenCalledOnce();
    expect(mocks.track).toHaveBeenCalledWith("Persona Activation Started", { target_persona: "Seller-Developer" });
  });

  it("switches an already activated inactive persona", async () => {
    const client = await import("@/lib/api/client");
    vi.mocked(client.customerApi.personas).mockResolvedValueOnce({ success: true, message: "ok", data: { activePersona: "BUYER", personas: [
      { type: "BUYER", onboardingStatus: "COMPLETED", activated: true },
      { type: "SELLER_DEVELOPER", onboardingStatus: "COMPLETED", activated: true }
    ] } });
    mocks.refreshSession.mockResolvedValueOnce({ activePersona: "SELLER_DEVELOPER", personas: [{ type: "BUYER", onboardingStatus: "COMPLETED" }, { type: "SELLER_DEVELOPER", onboardingStatus: "COMPLETED" }], nextAction: "OPEN_SELLER_DASHBOARD" });
    renderWithQuery(<PersonaSwitcher open onClose={mocks.close} />);
    await userEvent.click(await screen.findByRole("button", { name: /^switch$/i }));
    await waitFor(() => expect(mocks.switchPersona.mock.calls[0]?.[0]).toBe("SELLER_DEVELOPER"));
    expect(mocks.push).toHaveBeenCalledWith("/seller/listings");
    expect(mocks.refreshSession).toHaveBeenCalledOnce();
    expect(mocks.track).toHaveBeenCalledWith("Persona Switched", { from_persona: "Buyer", to_persona: "Seller-Developer" });
  });

  it("switches back to a completed Buyer and uses the refreshed canonical destination", async () => {
    const client = await import("@/lib/api/client");
    vi.mocked(client.customerApi.personas).mockResolvedValueOnce({ success: true, message: "ok", data: { activePersona: "SELLER_DEVELOPER", personas: [
      { type: "BUYER", onboardingStatus: "COMPLETED", activated: true },
      { type: "SELLER_DEVELOPER", onboardingStatus: "COMPLETED", activated: true }
    ] } });
    mocks.switchPersona.mockResolvedValueOnce({ success: true, data: { activePersona: "BUYER", nextAction: "OPEN_BUYER_DASHBOARD" } });
    mocks.refreshSession.mockResolvedValueOnce({ activePersona: "BUYER", personas: [{ type: "BUYER", onboardingStatus: "COMPLETED" }, { type: "SELLER_DEVELOPER", onboardingStatus: "COMPLETED" }], nextAction: "OPEN_BUYER_DASHBOARD" });
    renderWithQuery(<PersonaSwitcher open onClose={mocks.close} />);
    await userEvent.click(await screen.findByRole("button", { name: /^switch$/i }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/marketplace"));
  });

  it("uses refreshed onboarding state rather than a stale mutation destination", async () => {
    const client = await import("@/lib/api/client");
    vi.mocked(client.customerApi.personas).mockResolvedValueOnce({ success: true, message: "ok", data: { activePersona: "SELLER_DEVELOPER", personas: [
      { type: "BUYER", onboardingStatus: "NOT_STARTED", activated: true },
      { type: "SELLER_DEVELOPER", onboardingStatus: "COMPLETED", activated: true }
    ] } });
    mocks.switchPersona.mockResolvedValueOnce({ success: true, data: { activePersona: "BUYER", nextAction: "OPEN_BUYER_DASHBOARD" } });
    mocks.refreshSession.mockResolvedValueOnce({ activePersona: "BUYER", personas: [{ type: "BUYER", onboardingStatus: "NOT_STARTED" }], nextAction: "COMPLETE_BUYER_ONBOARDING" });
    renderWithQuery(<PersonaSwitcher open onClose={mocks.close} />);
    await userEvent.click(await screen.findByRole("button", { name: /^switch$/i }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/onboarding/buyer"));
  });

  it("replaces the stale active badge with the refreshed persona state", async () => {
    const client = await import("@/lib/api/client");
    vi.mocked(client.customerApi.personas)
      .mockResolvedValueOnce({ success: true, message: "ok", data: { activePersona: "BUYER", personas: [{ type: "BUYER", onboardingStatus: "COMPLETED", activated: true }, { type: "SELLER_DEVELOPER", onboardingStatus: "COMPLETED", activated: true }] } })
      .mockResolvedValueOnce({ success: true, message: "ok", data: { activePersona: "SELLER_DEVELOPER", personas: [{ type: "BUYER", onboardingStatus: "COMPLETED", activated: true }, { type: "SELLER_DEVELOPER", onboardingStatus: "COMPLETED", activated: true }] } });
    mocks.refreshSession.mockResolvedValueOnce({ activePersona: "SELLER_DEVELOPER", personas: [{ type: "BUYER", onboardingStatus: "COMPLETED" }, { type: "SELLER_DEVELOPER", onboardingStatus: "COMPLETED" }], nextAction: "OPEN_SELLER_DASHBOARD" });
    renderWithQuery(<PersonaSwitcher open onClose={mocks.close} />);
    await userEvent.click(await screen.findByRole("button", { name: /^switch$/i }));
    const sellerRow = screen.getByText("Seller").closest(".persona-row") as HTMLElement;
    await waitFor(() => expect(within(sellerRow).getByText("Active")).toBeVisible());
    const buyerRow = screen.getByText("Buyer").closest(".persona-row") as HTMLElement;
    expect(within(buyerRow).queryByText("Active")).not.toBeInTheDocument();
  });

  it("keeps the previous persona active when the server switch fails", async () => {
    const client = await import("@/lib/api/client");
    vi.mocked(client.customerApi.personas).mockResolvedValueOnce({ success: true, message: "ok", data: { activePersona: "BUYER", personas: [
      { type: "BUYER", onboardingStatus: "COMPLETED", activated: true },
      { type: "SELLER_DEVELOPER", onboardingStatus: "COMPLETED", activated: true }
    ] } });
    mocks.switchPersona.mockRejectedValueOnce(new Error("Switch unavailable"));
    renderWithQuery(<PersonaSwitcher open onClose={mocks.close} />);
    await userEvent.click(await screen.findByRole("button", { name: /^switch$/i }));
    expect(await screen.findByText("Something went wrong. Please try again.")).toBeVisible();
    expect(within(screen.getByText("Buyer").closest(".persona-row") as HTMLElement).getByText("Active")).toBeVisible();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("prevents duplicate persona mutations while a switch is pending", async () => {
    const client = await import("@/lib/api/client");
    vi.mocked(client.customerApi.personas).mockResolvedValueOnce({ success: true, message: "ok", data: { activePersona: "BUYER", personas: [
      { type: "BUYER", onboardingStatus: "COMPLETED", activated: true },
      { type: "SELLER_DEVELOPER", onboardingStatus: "COMPLETED", activated: true }
    ] } });
    let resolveSwitch!: (value: unknown) => void;
    mocks.switchPersona.mockReturnValueOnce(new Promise((resolve) => { resolveSwitch = resolve; }));
    renderWithQuery(<PersonaSwitcher open onClose={mocks.close} />);
    const button = await screen.findByRole("button", { name: /^switch$/i });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(mocks.switchPersona).toHaveBeenCalledTimes(1));
    resolveSwitch({ success: true, data: { activePersona: "SELLER_DEVELOPER", nextAction: "OPEN_SELLER_DASHBOARD" } });
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
  });

  it("exposes logout from the shared Buyer and Seller account dialog", async () => {
    renderWithQuery(<PersonaSwitcher open onClose={mocks.close} />);
    await userEvent.click(await screen.findByRole("button", { name: /^log out$/i }));
    expect(mocks.logout).toHaveBeenCalledOnce();
    expect(mocks.replace).toHaveBeenCalledWith("/marketplace");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("closes with Escape", async () => {
    renderWithQuery(<PersonaSwitcher open onClose={mocks.close} />);
    await userEvent.keyboard("{Escape}");
    expect(mocks.close).toHaveBeenCalled();
  });
});
