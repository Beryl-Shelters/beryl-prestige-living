import { describe, expect, it, vi } from "vitest";
import { AppError } from "../utils/AppError";
import { errorMiddleware } from "./error.middleware";

const response = () => {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { response: { status } as never, status, json };
};

describe("error middleware", () => {
  it("does not expose unexpected provider or database error messages", () => {
    const target = response();
    errorMiddleware(new Error("password authentication failed for provider"), {} as never, target.response, vi.fn());
    expect(target.status).toHaveBeenCalledWith(500);
    expect(target.json).toHaveBeenCalledWith({ success: false, message: "Internal server error" });
  });

  it("preserves safe structured application errors", () => {
    const target = response();
    errorMiddleware(new AppError("Referral not found", 404, "REFERRAL_NOT_FOUND"), {} as never, target.response, vi.fn());
    expect(target.status).toHaveBeenCalledWith(404);
    expect(target.json).toHaveBeenCalledWith({ success: false, message: "Referral not found", code: "REFERRAL_NOT_FOUND" });
  });
});
