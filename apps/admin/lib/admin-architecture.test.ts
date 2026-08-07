import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const source = (file: string) => readFileSync(path.resolve(__dirname, "..", file), "utf8");
describe("Admin BFF security architecture", () => {
  it("uses separate HttpOnly Admin cookies without browser storage", () => { const cookies = source("lib/server/admin-cookies.ts"); expect(cookies).toContain("beryl_admin_access"); expect(cookies).toContain("beryl_admin_refresh"); expect(cookies).toContain("beryl_admin_change_password"); expect(cookies).toContain("httpOnly: true"); expect(cookies).toContain('sameSite: "lax"'); });
  it("strips normal tokens and restricted proofs from BFF JSON", () => { const verify = source("app/api/admin/verify-login-otp/route.ts"); expect(verify).toContain("const { changePasswordToken, expiresIn, ...safeData }"); expect(verify).toContain("const { accessToken, refreshToken"); expect(verify).toContain("setAdminSession"); });
  it("only provides mounted Admin endpoints", () => { const readme = source("README.md"); expect(readme).toContain("no mounted refresh or logout endpoint"); expect(source("app/api/admin/clear-session/route.ts")).toContain("Local Admin session cleared"); });
});
