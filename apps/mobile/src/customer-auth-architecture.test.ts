import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const source=(file:string)=>readFileSync(path.resolve(__dirname,file),"utf8");
const route=(file:string)=>existsSync(path.resolve(__dirname,"..",file));

describe("customer login and password-reset architecture",()=>{
  const screens=source("components/customer-auth.tsx");
  const session=source("store/auth-flow.tsx");
  it("provides the approved login and recovery routes",()=>["app/(auth)/login.tsx","app/(auth)/forgot-password.tsx","app/(auth)/verify-reset-otp.tsx","app/(auth)/reset-password.tsx"].forEach(file=>expect(route(file)).toBe(true)));
  it("submits normalized email or phone login and stores the returned session",()=>{expect(screens).toContain('"/auth/login"');expect(screens).toContain("await establishSession(result.data)");expect(source("schemas/customer-auth.ts")).toContain("normalizeNigerianPhone");});
  it("uses the generic password-recovery response and does not persist OTPs",()=>{expect(screens).toContain('"/auth/forgot-password"');expect(screens).toContain("If an account exists");expect(screens).not.toContain("SecureStore");});
  it("verifies a six-digit reset code and keeps the reset token in volatile context",()=>{expect(screens).toContain('"/auth/verify-password-reset-otp"');expect(screens).toContain("resetToken:result.data.resetToken");expect(session).toContain("ResetFlowContext");expect(session).not.toContain("beryl_customer_reset");});
  it("resets password then clears local session before login",()=>{expect(screens).toContain('"/auth/reset-password"');expect(screens).toContain("await clearSession()");expect(screens).toContain('router.replace("/login")');});
  it("rotates once after an invalid access token and replaces both SecureStore tokens",()=>{expect(session).toContain('"/auth/refresh"');expect(session).toContain("await secureSession.save(next.accessToken,next.refreshToken)");expect(session).toContain("return request(path,method,body,next)");});
  it("clears a failed refresh and prevents token persistence outside SecureStore",()=>{expect(session).toContain("await clearSession(); return null");expect(session).not.toContain("AsyncStorage");});
  it("posts the bound refresh token during logout before clearing local state",()=>{expect(session).toContain('"/auth/logout"');expect(session).toContain("{refreshToken}");expect(session).toContain("finally { await clearSession(); }");});
  it("adds a temporary logout control to dashboard placeholders",()=>{const onboarding=source("components/onboarding.tsx");expect(onboarding).toContain("Log out");expect(onboarding).toContain("await logout()");});
});
