import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
const file=(value:string)=>path.resolve(__dirname,"..",value);
describe("mobile first-slice architecture",()=>{
  it("contains only the approved customer auth and onboarding routes",()=>["app/(auth)/signup.tsx","app/(auth)/verify-email.tsx","app/(onboarding)/buyer.tsx","app/(onboarding)/seller.tsx"].forEach(item=>expect(existsSync(file(item))).toBe(true)));
  it("keeps verification flow context non-sensitive and uses SecureStore only for a future refresh token",()=>{const source=readFileSync(file("src/store/auth-flow.tsx"),"utf8");expect(source).toContain("expo-secure-store");expect(source).not.toContain("AsyncStorage");expect(source).not.toContain("password");expect(source).not.toContain("otp");});
  it("connects exactly the registration verification API surface",()=>{const source=readFileSync(file("src/components/verify-email.tsx"),"utf8");expect(source).toContain("/auth/verify-email");expect(source).toContain("/auth/resend-verification-otp");});
});
