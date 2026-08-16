import { readFileSync } from "node:fs";
import path from "node:path";

const source = (file: string) => readFileSync(path.resolve(__dirname, file), "utf8");

describe("mobile onboarding Mixpanel analytics", () => {
  const onboarding = source("components/onboarding.tsx");
  const analytics = source("analytics/customer.ts");
  const switcher = source("components/persona-switcher.tsx");

  it("tracks Buyer completion only for the valid Find a property action with structured, non-PII properties", () => {
    expect(onboarding).toContain('"Buyer Onboarding Completed"');
    expect(onboarding).toContain('high<low');
    expect(onboarding).toContain('preferred_locations:selected');
    expect(onboarding).toContain('budget_provided:low!==undefined||high!==undefined');
    expect(onboarding).toContain('if(!skip)void trackCustomerEventOnce("buyer-onboarding-completed"');
    expect(onboarding).toContain('skipped_budget:false');
    expect(onboarding.indexOf('high<low')).toBeLessThan(onboarding.indexOf('"Buyer Onboarding Completed"'));
    const eventCall = onboarding.slice(onboarding.indexOf('"Buyer Onboarding Completed"'), onboarding.indexOf("setBusy(true)", onboarding.indexOf('"Buyer Onboarding Completed"')));
    expect(eventCall).not.toContain("budgetMin:");
    expect(eventCall).not.toContain("budgetMax:");
  });

  it("tracks Seller completion only for the valid primary action after business validation", () => {
    expect(onboarding).toContain('"Seller Onboarding Completed"');
    expect(onboarding).toContain('type==="BUSINESS"&&(!companyName.trim()||!companyAddress.trim())');
    expect(onboarding).toContain('profile_type:type==="BUSINESS"?"Business":"Individual"');
    expect(onboarding).toContain('company_name_provided:Boolean(companyName.trim())');
    expect(onboarding).toContain('company_address_provided:Boolean(companyAddress.trim())');
    expect(onboarding).toContain('if(!skip)void trackCustomerEventOnce("seller-onboarding-completed"');
    expect(onboarding.indexOf('type==="BUSINESS"&&(!companyName.trim()||!companyAddress.trim())')).toBeLessThan(onboarding.indexOf('"Seller Onboarding Completed"'));
  });

  it("consumes an activation handoff once, defaults signup safely, and clears stale state on reset", () => {
    expect(switcher).toContain('prepareMobileOnboardingAnalytics("persona_activation")');
    expect(onboarding).toContain('trigger_source:consumeMobileOnboardingAnalytics()');
    expect(analytics).toContain('onboardingSource = "signup"');
    expect(analytics).toContain('const source = onboardingSource; onboardingSource = "signup"; return source');
    expect(onboarding).toContain('trackCustomerEventOnce(`onboarding-start-${type}`');
  });

  it("emits abandonment only for a ready, incomplete active-to-background episode", () => {
    expect(onboarding).toContain('AppState.addEventListener("change"');
    expect(onboarding).toContain('if(!ready||completed.current)return');
    expect(onboarding).toContain('state==="background"||state==="inactive"');
    expect(onboarding).toContain('!backgrounded.current');
    expect(onboarding).toContain('if(state==="active")backgrounded.current=false');
    expect(onboarding).toContain('complete:()=>{completed.current=true;}');
    expect(onboarding).toContain('const result=await patchAuthenticated');
  });

  it("does not introduce Customer Server events or prohibited completion payloads", () => {
    for (const event of ["Account Created", "OTP Sent", "OTP Verification Succeeded", "Persona Activated", "Customer Logged In", "Login Failed", "Password Reset OTP Verified", "Password Reset Completed"]) expect(onboarding).not.toContain(`trackCustomerEvent("${event}"`);
    expect(onboarding).not.toContain('company_name:companyName');
    expect(onboarding).not.toContain('company_address:companyAddress');
  });

  it("applies the safe Test environment prefix centrally without changing canonical event strings", () => {
    expect(analytics).toContain('mobileMixpanelEnvironment = (value = process.env.EXPO_PUBLIC_MIXPANEL_ENVIRONMENT)');
    expect(analytics).toContain('`[${environment}] ${event}`');
    expect(analytics).toContain('environment, ...(appVersion');
  });
});
