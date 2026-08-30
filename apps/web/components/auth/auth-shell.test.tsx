import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthShell } from "./auth-shell";

describe("AuthShell branding and features", () => {
  it.each(["FIND_PROPERTY", "LIST_PROPERTY"] as const)("shows check icons for every %s feature", (intent) => {
    const { container } = render(<AuthShell intent={intent}><p>Content</p></AuthShell>);
    expect(container.querySelectorAll(".feature-check")).toHaveLength(3);
    expect(container.querySelectorAll(".feature-check svg")).toHaveLength(3);
  });

  it("uses the single replaceable Beryl Shelter logo asset", () => {
    const { container } = render(<AuthShell><p>Content</p></AuthShell>);
    const logo = container.querySelector<HTMLImageElement>(".brand-logo-mark");
    expect(logo).toHaveAttribute("src", "/brand/android-chrome-192x192.png");
    expect(logo).toHaveAttribute("width", "48");
    expect(logo).toHaveAttribute("height", "48");
    expect(screen.getByText("Beryl Shelter")).toHaveClass("brand-wordmark");
  });

  it("keeps the shared responsive artwork and form-panel structure", () => {
    const { container } = render(<AuthShell><p>Content</p></AuthShell>);

    expect(container.querySelector("main.auth-shell")).toBeInTheDocument();
    expect(container.querySelector("aside.auth-artwork")).toBeInTheDocument();
    expect(container.querySelector(".auth-artwork-image")).toBeInTheDocument();
    expect(container.querySelector("section.auth-panel")).toBeInTheDocument();
  });
});
