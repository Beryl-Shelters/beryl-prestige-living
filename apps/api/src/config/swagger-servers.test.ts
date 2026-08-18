import { describe, expect, it } from "vitest";
import { swaggerSpec } from "./swagger";

const specification = swaggerSpec as {
  openapi?: string;
  servers?: Array<{ url: string; description?: string }>;
  paths?: Record<string, unknown>;
};

describe("Swagger server environments", () => {
  it("lists the current, preview, production, and local servers in safe order", () => {
    expect(specification.openapi).toBe("3.0.3");
    expect(specification.servers).toEqual([
      { url: "/api/v1", description: "Current server" },
      { url: "https://dev-api.berylshelter.com/api/v1", description: "Preview server" },
      { url: "https://api.berylshelter.com/api/v1", description: "Production server" },
      { url: "http://localhost:5000/api/v1", description: "Local development server" }
    ]);
  });

  it("does not retain legacy Render servers and preserves the documented API surface", () => {
    expect(specification.servers?.some((server) => server.url.includes(".onrender.com"))).toBe(false);
    expect(Object.keys(specification.paths ?? {})).toHaveLength(130);
    expect(specification.paths?.["/admin/auth/login"]).toBeDefined();
    expect(specification.paths?.["/auth/register"]).toBeDefined();
  });
});
