import { describe, expect, it } from "vitest";

describe("authentication route mounting", () => {
  it("mounts only the implemented customer registration OTP slice", async () => {
    process.env.SUPABASE_URL ||= "http://127.0.0.1:54321";
    process.env.SUPABASE_ANON_KEY ||= "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";

    const { default: authRoutes } = await import("./auth.routes");
    const paths = (authRoutes as unknown as { stack: Array<Record<string, any>> }).stack
      .map((layer: any) => layer.route?.path)
      .filter(Boolean);

    expect(paths).toContain("/register");
    expect(paths).toContain("/verify-email");
    expect(paths).toContain("/resend-verification-otp");
  });
});
