import { describe, expect, it } from "vitest";

describe("location search route", () => {
  it("mounts one public, rate-limited Nigeria search operation", async () => {
    const { default: routes } = await import("./location.routes");
    const operations = (routes as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
        middleware: layer.route.stack.map((entry: any) => entry.handle.name),
      }));
    expect(operations).toEqual([{ path: "/search", methods: ["get"], middleware: ["", "search"] }]);
  });
});
