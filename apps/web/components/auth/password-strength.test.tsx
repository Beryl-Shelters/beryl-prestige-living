import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasswordStrength } from "./password-strength";

describe("PasswordStrength", () => {
  it.each([
    ["", "Meter", "neutral", 0, "0%"],
    ["A", "Weak", "weak", 1, "20%"],
    ["Abcdefgh", "Moderate", "moderate", 3, "60%"],
    ["Password123!", "Strong", "strong", 5, "100%"]
  ])("renders the expected state for score %s", (password, label, strength, score, width) => {
    const { container } = render(<PasswordStrength password={password} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", String(score));
    expect(container.querySelector(".password-meter-fill")).toHaveAttribute("data-strength", strength);
    expect(container.querySelector(".password-meter-fill")).toHaveStyle({ width });
  });

  it("uses visible checked and unchecked requirement states", () => {
    const { container } = render(<PasswordStrength password="A" />);
    expect(screen.getByLabelText(/uppercase letter: met/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/at least 8 characters: not met/i)).toBeInTheDocument();
    expect(container.querySelectorAll(".password-requirement-check")).toHaveLength(1);
  });
});
