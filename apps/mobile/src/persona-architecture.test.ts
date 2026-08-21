import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
const source=(file:string)=>readFileSync(path.resolve(__dirname,file),"utf8");
describe("mobile persona switching",()=>{
  const session=source("store/auth-flow.tsx"); const switcher=source("components/persona-switcher.tsx");
  it("centralizes persona list, activation, switching and status refresh",()=>{expect(session).toContain('"/personas"');expect(session).toContain('"/personas/activate"');expect(session).toContain('"/personas/active"');expect(session).toContain("refreshOnboardingStatus");});
  it("uses the existing authenticated request and therefore shared refresh rotation",()=>{expect(session).toContain("authenticatedRequest<PersonaList>");expect(session).toContain("refreshInFlight");});
  it("renders customer labels without raw seller enum values",()=>{expect(switcher).toContain('"Seller / Developer"');expect(switcher).not.toContain(">SELLER_DEVELOPER<");});
  it("has activation and switching actions with an accessible dismiss control",()=>{expect(switcher).toContain('"Activate"');expect(switcher).toContain('"Switch"');expect(switcher).toContain('"Close profile switcher"');});
  it("keeps the switcher open without re-routing the dashboard during a status refresh",()=>{const onboarding=source("components/onboarding.tsx");const dashboard=onboarding.slice(onboarding.indexOf("export function DashboardPlaceholder"));expect(dashboard).toContain("Switch profile");expect(dashboard).toContain("PersonaSwitcher");expect(dashboard).not.toContain("refreshOnboardingStatus");expect(dashboard).toContain("Buyer dashboard placeholder");expect(dashboard).toContain("Seller dashboard placeholder");});
  it("keeps both personas and session tokens after a persona mutation",()=>{expect(session).toContain("personas:list?.personas");expect(session).toContain("secureSession");expect(session).not.toContain("AsyncStorage");});
  it("routes completed buyers to Marketplace while preserving the seller placeholder",()=>{const buyer=source("../app/(app)/buyer-dashboard.tsx");expect(buyer).toContain('href="/marketplace"');expect(existsSync(path.resolve(__dirname,"../app/(app)/seller-dashboard.tsx"))).toBe(true);});
  it("guards direct onboarding routes with backend-confirmed activation",()=>{const onboarding=source("components/onboarding.tsx");expect(onboarding).toContain("session.fetchPersonas()");expect(onboarding).toContain("persona?.activated!==true");expect(onboarding).toContain('pathname.includes("seller")');expect(onboarding).toContain("status?session.routeFromNextAction(status.nextAction)");});
  it("activates an unavailable persona before routing and switches only activated personas",()=>{const switcher=source("components/persona-switcher.tsx");expect(switcher).toContain("persona.activated?await switchPersona");expect(switcher).toContain(":await activatePersona");expect(switcher).toContain("onNavigate(result.nextAction)");});
});
