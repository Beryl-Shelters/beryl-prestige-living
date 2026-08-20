import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "@/test/render";
import type { CustomerSessionState } from "@/lib/contracts";

const mocks = vi.hoisted(() => ({ auth: { session: null as CustomerSessionState | null, sessionLoading: false, logout: vi.fn() } }));
vi.mock("@/context/auth-provider", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/components/persona/persona-switcher", () => ({ PersonaSwitcher: () => null }));

import { MarketplaceHeader } from "./marketplace-header";

describe("Marketplace header session states", () => {
  beforeEach(() => { mocks.auth.session = null; mocks.auth.sessionLoading = false; });

  it("keeps public Marketplace entry controls available anonymously", () => {
    renderWithQuery(<MarketplaceHeader returnTo="/marketplace" />);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?returnTo=%2Fmarketplace");
    expect(screen.getByRole("link", { name: "Get started" })).toBeInTheDocument();
  });

  it("shows authenticated account controls instead of public auth prompts", () => {
    mocks.auth.session = { user: { id: "customer", fullName: "Test Customer", email: "test@example.com", phone: null, accountStatus: "ACTIVE", emailVerified: true }, activePersona: "BUYER", personas: [], nextAction: "OPEN_BUYER_DASHBOARD" };
    renderWithQuery(<MarketplaceHeader returnTo="/marketplace" />);
    expect(screen.getByRole("button", { name: /test customer/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Saved" })).toHaveAttribute("href", "/saved");
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });
});
