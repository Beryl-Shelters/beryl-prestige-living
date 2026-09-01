import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery } from "@/test/render";
import type { CustomerSessionState } from "@/lib/contracts";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), auth: { session: null as CustomerSessionState | null, sessionLoading: false, logout: vi.fn(), logoutPending: false } }));
vi.mock("@/context/auth-provider", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/components/persona/persona-switcher", () => ({ PersonaSwitcher: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));

import { MarketplaceHeader } from "./marketplace-header";

describe("Marketplace header session states", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.auth.session = null; mocks.auth.sessionLoading = false; mocks.auth.logoutPending = false; mocks.auth.logout.mockResolvedValue(undefined); });

  it("keeps public Marketplace entry controls available anonymously", () => {
    renderWithQuery(<MarketplaceHeader returnTo="/marketplace" />);
    expect(screen.getByRole("link", { name: "Refer & Earn" })).toHaveAttribute("href", "/refer");
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?returnTo=%2Fmarketplace");
    expect(screen.getByRole("link", { name: "Get started" })).toBeInTheDocument();
  });

  it("shows authenticated account controls instead of public auth prompts", () => {
    mocks.auth.session = { user: { id: "customer", fullName: "Test Customer", email: "test@example.com", phone: null, accountStatus: "ACTIVE", emailVerified: true }, activePersona: "BUYER", personas: [], nextAction: "OPEN_BUYER_DASHBOARD" };
    renderWithQuery(<MarketplaceHeader returnTo="/marketplace" />);
    expect(screen.getByRole("button", { name: /test customer/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Refer & Earn" })).toHaveAttribute("href", "/refer");
    expect(screen.getByRole("link", { name: "Saved" })).toHaveAttribute("href", "/saved");
    expect(screen.queryByRole("link", { name: "Log in" })).not.toBeInTheDocument();
  });

  it("reduces the Seller-embedded header to the Marketplace search without duplicate account navigation", () => {
    mocks.auth.session = { user: { id: "customer", fullName: "Test Seller", email: "seller@example.com", phone: null, accountStatus: "ACTIVE", emailVerified: true }, activePersona: "SELLER_DEVELOPER", personas: [], nextAction: "OPEN_SELLER_DASHBOARD" };
    renderWithQuery(<MarketplaceHeader embedded returnTo="/marketplace" />);

    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Beryl Shelter Marketplace" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Refer & Earn" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /test seller/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^log out$/i })).not.toBeInTheDocument();
  });

  it("logs an authenticated Buyer out through the existing session flow", async () => {
    mocks.auth.session = { user: { id: "customer", fullName: "Test Customer", email: "test@example.com", phone: null, accountStatus: "ACTIVE", emailVerified: true }, activePersona: "BUYER", personas: [], nextAction: "OPEN_BUYER_DASHBOARD" };
    renderWithQuery(<MarketplaceHeader returnTo="/marketplace" />);
    await userEvent.click(screen.getByRole("button", { name: /^log out$/i }));
    await waitFor(() => expect(mocks.auth.logout).toHaveBeenCalledOnce());
    expect(mocks.replace).toHaveBeenCalledWith("/login");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
