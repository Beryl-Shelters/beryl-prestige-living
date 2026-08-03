import { describe, expect, it } from "vitest";

describe("customer onboarding and persona route mounting", () => {
  it("mounts exactly the three onboarding and three persona operations", async () => {
    process.env.SUPABASE_URL ||= "http://127.0.0.1:54321";
    process.env.SUPABASE_ANON_KEY ||= "test-anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";

    const [{ default: onboardingRoutes }, { default: personaRoutes }] =
      await Promise.all([
        import("./customer-onboarding.routes"),
        import("./customer-persona.routes")
      ]);

    const operations = (router: any) =>
      router.stack
        .filter((layer: any) => layer.route)
        .map((layer: any) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods)
        }));

    expect(operations(onboardingRoutes)).toEqual([
      { path: "/status", methods: ["get"] },
      { path: "/buyer", methods: ["patch"] },
      { path: "/seller", methods: ["patch"] }
    ]);
    expect(operations(personaRoutes)).toEqual([
      { path: "/", methods: ["get"] },
      { path: "/activate", methods: ["post"] },
      { path: "/active", methods: ["patch"] }
    ]);
  });

  it("applies authentication and verified-customer guards before handlers", async () => {
    const { default: onboardingRoutes } = await import(
      "./customer-onboarding.routes"
    );
    const middlewareNames = (onboardingRoutes as any).stack
      .filter((layer: any) => !layer.route)
      .flatMap((layer: any) => layer.handle?.name ?? []);

    expect(middlewareNames).toEqual([
      "customerSessionMiddleware",
      "requireVerifiedCustomer"
    ]);
  });
});
