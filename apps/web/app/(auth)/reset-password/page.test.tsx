// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ resetProof: undefined as string | undefined, redirect: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => name === "beryl_reset_proof" && state.resetProof
      ? { name, value: state.resetProof }
      : undefined
  }))
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    state.redirect(path);
    throw new Error("NEXT_REDIRECT");
  },
  useRouter: vi.fn()
}));

import ResetPasswordPage from "./page";

describe("reset-password page proof gate", () => {
  beforeEach(() => {
    state.resetProof = undefined;
    state.redirect.mockClear();
  });

  it("redirects a direct reset URL without a verified HttpOnly proof", async () => {
    await expect(ResetPasswordPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(state.redirect).toHaveBeenCalledWith("/forgot-password");
  });

  it("renders only when the verified HttpOnly proof is present", async () => {
    state.resetProof = "opaque-proof";
    const page = await ResetPasswordPage();
    expect(page.type).toBeDefined();
    expect(state.redirect).not.toHaveBeenCalled();
  });
});
