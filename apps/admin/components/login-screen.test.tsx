/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-unused-vars */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginScreen } from "./login-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/image", () => ({ default: ({ priority: _priority, fill: _fill, ...props }: Record<string, unknown>) => <img {...props} alt="" /> }));

describe("Admin login", () => {
  it("renders the approved Admin login copy and controls", () => {
    render(<LoginScreen />);
    expect(screen.getByRole("heading", { name: "Login to your admin account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log In" })).toBeInTheDocument();
  });
});
