import { describe, expect, it } from "vitest";
import { createCorsOptions, parseAllowedOrigins } from "./cors";

const productionOrigins = "https://www.berylshelter.com, https://app.berylshelter.com/,https://admin.berylshelter.com";
const previewOrigins = "https://dev.berylshelter.com,https://dev-admin.berylshelter.com";

const checkOrigin = (origins: string[], origin?: string) => new Promise<{ error: Error | null; allowed?: boolean }>((resolve) => {
  const options = createCorsOptions(origins);
  const handler = options.origin;
  if (typeof handler !== "function") throw new Error("Expected an origin callback");
  handler(origin, (error, allowed) => resolve({ error, allowed: allowed === true ? true : undefined }));
});

describe("CORS origin allowlist", () => {
  it("parses production and preview origin lists without wildcard support", () => {
    expect(parseAllowedOrigins(`${productionOrigins}, ,*`)).toEqual([
      "https://www.berylshelter.com",
      "https://app.berylshelter.com",
      "https://admin.berylshelter.com"
    ]);
    expect(parseAllowedOrigins(previewOrigins)).toEqual([
      "https://dev.berylshelter.com",
      "https://dev-admin.berylshelter.com"
    ]);
  });

  it("allows configured origins, including a trailing slash", async () => {
    const origins = parseAllowedOrigins(productionOrigins);
    for (const origin of [...origins, "https://app.berylshelter.com/"]) {
      await expect(checkOrigin(origins, origin)).resolves.toEqual({ error: null, allowed: true });
    }
  });

  it("rejects unknown browser origins without disclosing the allowlist", async () => {
    const result = await checkOrigin(parseAllowedOrigins(previewOrigins), "https://unapproved.example.com");
    expect(result.allowed).toBeUndefined();
    expect(result.error?.message).toBe("Origin not allowed by CORS");
  });

  it("allows requests without an Origin header for native and server clients", async () => {
    await expect(checkOrigin(parseAllowedOrigins(productionOrigins))).resolves.toEqual({ error: null, allowed: true });
  });

  it("keeps credentialed CORS enabled", () => {
    expect(createCorsOptions(parseAllowedOrigins(productionOrigins)).credentials).toBe(true);
  });
});
