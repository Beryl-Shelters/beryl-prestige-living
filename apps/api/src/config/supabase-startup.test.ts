import { afterEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();

afterEach(() => {
  vi.doUnmock("./env");
  vi.doUnmock("@supabase/supabase-js");
  vi.resetModules();
  createClient.mockReset();
});

describe.each(["preview", "production"])(
  "Supabase %s startup guard",
  (deploymentEnvironment) => {
    it("fails before creating a Supabase client when the project ref mismatches", async () => {
      vi.doMock("./env", () => ({
        env: {
          deploymentEnvironment,
          expectedSupabaseProjectRef: "expectedprojectref",
          supabaseUrl: "https://differentprojectref.supabase.co",
          supabaseAnonKey: "test-anon-key",
          supabaseServiceRoleKey: "test-service-role-key"
        }
      }));
      vi.doMock("@supabase/supabase-js", () => ({ createClient }));

      await expect(import("./supabase")).rejects.toThrow(
        /does not match EXPECTED_SUPABASE_PROJECT_REF/
      );
      expect(createClient).not.toHaveBeenCalled();
    });
  }
);
