// @vitest-environment node

import { describe, expect, it } from "vitest";
import { formatNumericInput, numericInputValue } from "./numeric-input";

describe("numeric price input formatting", () => {
  it("keeps digits only and adds thousands separators", () => {
    expect(formatNumericInput("2m80000000")).toBe("280,000,000");
    expect(formatNumericInput(50000008)).toBe("50,000,008");
  });

  it("converts a formatted value back to its numeric API value", () => {
    expect(numericInputValue("280,000,000")).toBe(280000000);
    expect(numericInputValue("no amount")).toBeNull();
  });
});
