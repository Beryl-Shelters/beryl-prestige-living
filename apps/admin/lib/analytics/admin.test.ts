import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ init: vi.fn(), register: vi.fn(), track: vi.fn(), reset: vi.fn(), identify: vi.fn(), get_distinct_id: vi.fn() }));
vi.mock("mixpanel-browser", () => ({ default: mocks }));

describe("Admin Mixpanel environment prefix", () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.stubEnv("NEXT_PUBLIC_MIXPANEL_ADMIN_TOKEN", "admin-token"); });
  afterEach(() => vi.unstubAllEnvs());

  it("defaults safely to Test and retains canonical event constants", async () => {
    const { adminMixpanelEventName, trackAdminEvent } = await import("./admin");
    await trackAdminEvent("Login Submitted", {});
    expect(adminMixpanelEventName("Login Submitted")).toBe("[Test] Login Submitted");
    expect(mocks.track).toHaveBeenCalledWith("[Test] Login Submitted", expect.objectContaining({ environment: "Test", platform: "Web" }));
  });

  it("uses Production only for the explicit production setting", async () => {
    vi.stubEnv("NEXT_PUBLIC_MIXPANEL_ENVIRONMENT", "production");
    const { trackAdminEvent } = await import("./admin");
    await trackAdminEvent("Login Submitted", {});
    expect(mocks.track).toHaveBeenCalledWith("[Production] Login Submitted", expect.objectContaining({ environment: "Production" }));
  });
});
