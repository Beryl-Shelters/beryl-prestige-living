import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasswordStrength } from "./password-strength";

describe("PasswordStrength", () => {
  it.each([
    ["a", "Weak", "Try a longer, more unique password that is harder to guess.", "weak"],
    ["Abcdef12", "Moderate", "Getting stronger. Add more symbols or numbers for better protection.", "moderate"],
    ["Abcdef12!", "Strong", "Great job! This password is strong and secure.", "strong"]
  ])("shows the %s state", (password, label, message, strength) => {
    const { container } = render(<PasswordStrength password={password} />);
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
    expect(container.querySelector(".password-meter > span")).toHaveAttribute("data-strength", strength);
  });
});
