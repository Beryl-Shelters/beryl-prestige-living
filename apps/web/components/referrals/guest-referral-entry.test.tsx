import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GuestReferralMiniHero } from "./guest-referral-mini-hero";

describe("public homepage guest referral entry", () => {
  it("renders one semantic mini hero with the approved guest direct-referral CTA", () => {
    const { container } = render(<GuestReferralMiniHero href="/refer/direct" />);

    expect(container.querySelectorAll('[data-referral-entry="public-home"]')).toHaveLength(1);
    expect(screen.getByRole("heading", { name: /know someone buying or selling property in nigeria/i })).toBeVisible();
    expect(screen.getByText(/no account needed/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Fill in their details" })).toHaveAttribute("href", "/refer/direct");
  });

  it("does not turn login or signup into a prerequisite for the primary guest action", () => {
    render(<GuestReferralMiniHero href="/refer/direct" />);

    const action = screen.getByRole("link", { name: "Fill in their details" });
    expect(action.getAttribute("href")).not.toMatch(/\/(login|signup|onboarding)(?:\?|$)/);
    expect(screen.queryByRole("link", { name: /log in|create account|sign up/i })).not.toBeInTheDocument();
  });

});
