import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OtpInput } from "./otp-input";

describe("OtpInput", () => {
  it("auto-submits after the sixth numeric digit", async () => {
    const complete = vi.fn();
    render(<OtpInput onComplete={complete} />);
    const user = userEvent.setup();
    for (const [index, digit] of ["1", "2", "3", "4", "5", "6"].entries()) await user.type(screen.getByLabelText(`Digit ${index + 1}`), digit);
    expect(complete).toHaveBeenCalledWith("123456");
  });

  it("supports pasting a six-digit code", () => {
    const complete = vi.fn();
    render(<OtpInput onComplete={complete} />);
    fireEvent.paste(screen.getByRole("group"), { clipboardData: { getData: () => "419205" } });
    expect(complete).toHaveBeenCalledWith("419205");
  });
});
