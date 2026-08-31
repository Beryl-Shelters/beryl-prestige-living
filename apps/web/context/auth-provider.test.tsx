import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth-provider";

const mocks = vi.hoisted(() => ({ session: vi.fn(), logout: vi.fn(), reset: vi.fn(), track: vi.fn() }));

vi.mock("@/lib/api/client", () => ({ customerApi: { session: mocks.session, logout: mocks.logout } }));
vi.mock("@/lib/analytics/customer", () => ({
  customerPersonaForAnalytics: (value: string) => value,
  identifyCustomerAnalytics: vi.fn(),
  resetCustomerAnalytics: mocks.reset,
  trackCustomerEvent: mocks.track
}));

const buyerSession = {
  user: { id: "customer", fullName: "Ada Buyer", email: "ada@example.com", phone: null, accountStatus: "ACTIVE" as const, emailVerified: true as const },
  activePersona: "BUYER" as const,
  personas: [{ type: "BUYER" as const, onboardingStatus: "COMPLETED" as const, activated: true }],
  nextAction: "OPEN_BUYER_DASHBOARD" as const
};

function SessionProbe() {
  const { session, sessionLoading, logout, logoutPending } = useAuth();
  if (sessionLoading) return <p>Loading</p>;
  return <><p>{session ? session.activePersona : "Anonymous"}</p><button type="button" disabled={logoutPending} onClick={() => void logout()}>{logoutPending ? "Logging out" : "Log out"}</button></>;
}

describe("AuthProvider logout state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.session.mockResolvedValue({ success: true, message: "restored", data: buyerSession });
    mocks.reset.mockResolvedValue(undefined);
  });

  it("clears the restored session and private cache even if logout upstream fails", async () => {
    mocks.logout.mockRejectedValue(new Error("network unavailable"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(["saved-properties"], { private: true });
    client.setQueryData(["seller-marketplace-listings"], { private: true });
    client.setQueryData(["marketplace-properties", {}], { privateForThisRelease: true });
    client.setQueryData(["marketplace-property", "property-id"], { privateForThisRelease: true });
    render(<QueryClientProvider client={client}><AuthProvider><SessionProbe /></AuthProvider></QueryClientProvider>);
    expect(await screen.findByText("BUYER")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /^log out$/i }));
    await waitFor(() => expect(screen.getByText("Anonymous")).toBeVisible());
    expect(client.getQueryData(["saved-properties"])).toBeUndefined();
    expect(client.getQueryData(["seller-marketplace-listings"])).toBeUndefined();
    expect(client.getQueryData(["marketplace-properties", {}])).toBeUndefined();
    expect(client.getQueryData(["marketplace-property", "property-id"])).toBeUndefined();
    expect(mocks.logout).toHaveBeenCalledOnce();
    expect(mocks.reset).toHaveBeenCalledOnce();
  });

  it("deduplicates repeated logout requests", async () => {
    let resolveLogout!: () => void;
    mocks.logout.mockReturnValue(new Promise<void>((resolve) => { resolveLogout = resolve; }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><AuthProvider><SessionProbe /></AuthProvider></QueryClientProvider>);
    expect(await screen.findByText("BUYER")).toBeVisible();
    const button = screen.getByRole("button", { name: /^log out$/i });
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: /logging out/i })).toBeDisabled();
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    resolveLogout();
    await waitFor(() => expect(screen.getByText("Anonymous")).toBeVisible());
  });
});
