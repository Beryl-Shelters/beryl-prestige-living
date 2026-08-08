import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const fromApp = (file: string) => path.resolve(__dirname, "..", file);
const source = (file: string) => readFileSync(fromApp(file), "utf8");

describe("Admin onboarding architecture", () => {
  it("has no public Admin signup and includes every approved flow route", () => {
    expect(existsSync(fromApp("app/signup"))).toBe(false);
    ["app/activate/page.tsx", "app/activation-otp/page.tsx", "app/set-password/page.tsx", "app/dashboard/admins/page.tsx", "app/dashboard/change-password/page.tsx"].forEach((file) => expect(existsSync(fromApp(file))).toBe(true));
  });

  it("keeps invitation and setup credentials out of browser storage", () => {
    const activation = source("components/activation-screen.tsx");
    const verify = source("app/api/admin/verify-activation-otp/route.ts");
    expect(activation).toContain("beryl_admin_activation_challenge");
    expect(activation).not.toContain("sessionStorage.setItem(\"invitationToken");
    expect(verify).toContain("setSetupPasswordProof");
  });

  it("limits Admin management to the Super Admin dashboard route", () => {
    expect(source("app/dashboard/admins/page.tsx")).toContain('adminRole !== "SUPER_ADMIN"');
    expect(source("components/admin-management.tsx")).toContain("Add Admin");
    expect(source("components/admin-management.tsx")).toContain("Resend");
  });
});
