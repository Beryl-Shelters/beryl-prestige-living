import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OtpInput } from "./otp-input";

describe("Admin OTP input", () => {
  it("submits after six digits and supports paste", () => {
    const complete = vi.fn();
    render(<OtpInput onComplete={complete} />);
    fireEvent.paste(screen.getByRole("group"), { clipboardData: { getData: () => "123456" } });
    expect(complete).toHaveBeenCalledWith("123456");
  });
});
