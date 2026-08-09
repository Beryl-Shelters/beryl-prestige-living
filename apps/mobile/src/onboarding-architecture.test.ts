import { readFileSync } from "node:fs";
import path from "node:path";

const source = (file: string) => readFileSync(path.resolve(__dirname, file), "utf8");
const appSource = (file: string) => readFileSync(path.resolve(__dirname, "..", file), "utf8");

describe("customer onboarding session architecture", () => {
  it("keeps the signup password volatile and establishes a session after verification", () => {
    const signup = source("components/signup-form.tsx");
    const verify = source("components/verify-email.tsx");
    expect(signup).toMatch(/password:\s*payload\.password/);
    expect(verify).toContain('post<');
    expect(verify).toContain('"/auth/login"');
    expect(verify).toContain("await establishSession(login.data)");
    expect(verify).toContain("password:undefined");
  });

  it("uses SecureStore for customer tokens only", () => {
    const session = source("store/auth-flow.tsx");
    expect(session).toContain("beryl_customer_access_token");
    expect(session).toContain("beryl_customer_refresh_token");
    expect(session).toContain("expo-secure-store");
    expect(session).not.toContain("AsyncStorage");
    expect(session).not.toContain("password");
  });

  it("uses authenticated onboarding status, buyer and seller requests", () => {
    const client = source("api/client.ts");
    const onboarding = source("components/onboarding.tsx");
    expect(client).toContain("authorization: `Bearer ${accessToken}`");
    expect(onboarding).toContain('"/onboarding/status"');
    expect(onboarding).toContain('"/onboarding/buyer"');
    expect(onboarding).toContain('"/onboarding/seller"');
    expect(onboarding).toContain("skip?{skip:true}");
  });

  it("contains buyer/seller dashboard placeholders and route actions", () => {
    const session = source("store/auth-flow.tsx");
    expect(session).toContain('OPEN_BUYER_DASHBOARD: "/buyer-dashboard"');
    expect(session).toContain('OPEN_SELLER_DASHBOARD: "/seller-dashboard"');
    expect(appSource("app/(app)/buyer-dashboard.tsx")).toContain("DashboardPlaceholder");
    expect(appSource("app/(app)/seller-dashboard.tsx")).toContain("DashboardPlaceholder");
  });
});
