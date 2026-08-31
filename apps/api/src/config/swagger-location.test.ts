import { describe, expect, it } from "vitest";
import { swaggerSpec } from "./swagger";

describe("Nigeria location-search Swagger contract", () => {
  it("documents the bounded public endpoint and safe DTO", () => {
    const spec = swaggerSpec as any;
    const operation = spec.paths["/locations/search"].get;
    expect(operation.security).toEqual([]);
    expect(operation.parameters.find((parameter: any) => parameter.name === "q").schema).toMatchObject({ minLength: 2, maxLength: 80 });
    expect(operation.responses[200].content["application/json"].schema.properties.data.$ref).toBe("#/components/schemas/NigeriaLocationSearchResult");
    expect(spec.components.schemas.NigeriaLocationSearchResult.properties.locations.maxItems).toBe(12);
  });
});
