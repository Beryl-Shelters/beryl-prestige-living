import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SupabaseEnvironmentConfigurationError,
  validateSupabaseEnvironment
} from "./supabase-environment";

const previewRef = "previewprojectref";
const productionRef = "productionprojectref";
const hostedUrl = (projectRef: string) =>
  `https://${projectRef}.supabase.co`;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Supabase deployment environment guard", () => {
  it("requires an explicit deployment environment", () => {
    expect(() =>
      validateSupabaseEnvironment({
        supabaseUrl: hostedUrl(previewRef),
        expectedProjectRef: previewRef
      })
    ).toThrow(/DEPLOYMENT_ENVIRONMENT must be one of/);
  });

  it("accepts the expected Preview project", () => {
    expect(
      validateSupabaseEnvironment({
        deploymentEnvironment: "preview",
        supabaseUrl: hostedUrl(previewRef),
        expectedProjectRef: previewRef
      })
    ).toEqual({ deploymentEnvironment: "preview", projectRef: previewRef });
  });

  it("accepts the expected Production project", () => {
    expect(
      validateSupabaseEnvironment({
        deploymentEnvironment: "production",
        supabaseUrl: hostedUrl(productionRef),
        expectedProjectRef: productionRef
      })
    ).toEqual({
      deploymentEnvironment: "production",
      projectRef: productionRef
    });
  });

  it.each(["preview", "production"])(
    "rejects a project mismatch in %s",
    (deploymentEnvironment) => {
      expect(() =>
        validateSupabaseEnvironment({
          deploymentEnvironment,
          supabaseUrl: hostedUrl(productionRef),
          expectedProjectRef: previewRef
        })
      ).toThrow(/does not match EXPECTED_SUPABASE_PROJECT_REF/);
    }
  );

  it.each(["preview", "production"])(
    "requires an expected project ref in %s",
    (deploymentEnvironment) => {
      expect(() =>
        validateSupabaseEnvironment({
          deploymentEnvironment,
          supabaseUrl: hostedUrl(previewRef)
        })
      ).toThrow(/EXPECTED_SUPABASE_PROJECT_REF is required/);
    }
  );

  it("rejects a malformed Supabase URL", () => {
    expect(() =>
      validateSupabaseEnvironment({
        deploymentEnvironment: "preview",
        supabaseUrl: "not-a-url",
        expectedProjectRef: previewRef
      })
    ).toThrow(/SUPABASE_URL must be a valid URL/);
  });

  it("rejects a non-HTTPS hosted Supabase URL", () => {
    expect(() =>
      validateSupabaseEnvironment({
        deploymentEnvironment: "preview",
        supabaseUrl: `http://${previewRef}.supabase.co`,
        expectedProjectRef: previewRef
      })
    ).toThrow(/SUPABASE_URL must use HTTPS/);
  });

  it("uses DEPLOYMENT_ENVIRONMENT when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(
      validateSupabaseEnvironment({
        deploymentEnvironment: "preview",
        supabaseUrl: hostedUrl(previewRef),
        expectedProjectRef: previewRef
      }).deploymentEnvironment
    ).toBe("preview");
  });

  it.each(["local", "test"])(
    "allows a loopback Supabase URL in %s",
    (deploymentEnvironment) => {
      expect(
        validateSupabaseEnvironment({
          deploymentEnvironment,
          supabaseUrl: "http://127.0.0.1:54321"
        })
      ).toEqual({ deploymentEnvironment, projectRef: null });
    }
  );

  it("does not disclose or log secret values when validation fails", () => {
    const secrets = [
      "anon-secret-value",
      "service-role-secret-value",
      "customer-jwt-secret-value"
    ];
    vi.stubEnv("SUPABASE_ANON_KEY", secrets[0]);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", secrets[1]);
    vi.stubEnv("CUSTOMER_ACCESS_TOKEN_SECRET", secrets[2]);
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    let thrown: unknown;
    try {
      validateSupabaseEnvironment({
        deploymentEnvironment: "preview",
        supabaseUrl: hostedUrl(productionRef),
        expectedProjectRef: previewRef
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(SupabaseEnvironmentConfigurationError);
    for (const secret of secrets) {
      expect(String(thrown)).not.toContain(secret);
    }
    expect(errorLog).not.toHaveBeenCalled();
  });
});
