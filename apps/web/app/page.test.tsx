import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "www.berylshelter.test" }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/site-urls", () => ({
  customerAppUrl: (path: string) => path,
  isPublicWebHost: () => true,
}));

import HomePage from "./page";

describe("public homepage", () => {
  it("renders the guest referral entry without requiring a Customer session", async () => {
    render(await HomePage());

    expect(screen.getByRole("heading", { name: "Beryl Shelter" })).toBeVisible();
    expect(screen.getByRole("heading", { name: /know someone buying or selling property in nigeria/i })).toBeVisible();
    expect(screen.getByRole("link", { name: "Fill in their details" })).toHaveAttribute("href", "/refer/direct");
  });
});
