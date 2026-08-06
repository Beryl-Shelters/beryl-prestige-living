import { describe, expect, it } from "vitest";
import { swaggerSpec } from "./swagger";

describe("Admin authentication Swagger coverage", () => {
  it("documents all isolated Admin authentication and staff routes", () => {
    const paths = (swaggerSpec as { paths?: Record<string, unknown> }).paths ?? {};
    [
      "/admin/staff/invite", "/admin/staff/{adminId}/resend-invitation",
      "/admin/auth/activate", "/admin/auth/resend-activation-otp",
      "/admin/auth/verify-activation-otp", "/admin/auth/set-password"
    ].forEach((path) => expect(paths[path]).toBeDefined());
    expect(paths["/admin/users"]).toBeDefined();
    expect(paths["/admin/auth/login"]).toBeUndefined();
  });
});
