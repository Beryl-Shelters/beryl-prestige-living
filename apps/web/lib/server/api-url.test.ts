// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ApiConfigurationError, backendApiUrl, normalizedApiBase } from "./api-url";

describe("backend API URL construction", () => {
  it.each([
    "http://localhost:5000",
    "http://localhost:5000/",
    "http://localhost:5000/api/v1",
    "http://localhost:5000/api/v1/",
    "http://localhost:5000/api/v1/api/v1"
  ])("normalizes %s to exactly one API prefix", (base) => {
    expect(normalizedApiBase(base)).toBe("http://localhost:5000/api/v1");
  });

  it("appends endpoint paths safely", () => {
    expect(backendApiUrl("/auth/register", "https://example.com/")).toBe("https://example.com/api/v1/auth/register");
  });

  it("throws a clear error when API_BASE_URL is missing", () => {
    expect(() => normalizedApiBase("")).toThrow(ApiConfigurationError);
    expect(() => normalizedApiBase("")).toThrow(/API_BASE_URL is not configured/i);
  });
});
