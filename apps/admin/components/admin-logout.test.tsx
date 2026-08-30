import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminSessionState } from "@/lib/contracts";
import { AdminShell } from "./admin-dashboard";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), reset: vi.fn(), track: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("@/lib/analytics/admin", () => ({ identifyAdminAnalytics: vi.fn(), resetAdminAnalytics: mocks.reset, trackAdminEvent: mocks.track }));

const session = (adminRole: "ADMIN" | "SUPER_ADMIN"): AdminSessionState => ({
  admin: { id: "admin-id", fullName: "Ada Admin", email: "admin@example.com", department: "Operations", adminRole, status: "ACTIVE", requiresPasswordChange: false },
  nextAction: "OPEN_ADMIN_DASHBOARD",
  accessTokenExpiresIn: 900,
  refreshTokenExpiresIn: 604800
});

describe("Admin logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reset.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  });

  it.each(["ADMIN", "SUPER_ADMIN"] as const)("keeps logout visible and functional for %s", async (role) => {
    render(<AdminShell session={session(role)}><p>Private dashboard</p></AdminShell>);
    await userEvent.click(screen.getByRole("button", { name: /^log out$/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/logout", { method: "POST" }));
    expect(mocks.replace).toHaveBeenCalledWith("/login");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("prevents repeated logout requests while one is pending", async () => {
    let resolveFetch!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; })));
    render(<AdminShell session={session("ADMIN")}><p>Private dashboard</p></AdminShell>);
    const button = screen.getByRole("button", { name: /^log out$/i });
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: /logging out/i })).toBeDisabled();
    expect(fetch).toHaveBeenCalledTimes(1);
    resolveFetch(new Response(null, { status: 200 }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login"));
  });
});
