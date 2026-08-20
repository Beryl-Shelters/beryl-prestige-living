import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const migration = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/202608200001_marketplace_partial_drafts.sql"), "utf8");

describe("Marketplace partial draft compatibility", () => {
  it("allows legacy required listing fields to remain empty only while drafting", () => {
    for (const column of ["title", "category", "property_type", "price", "state"]) expect(migration).toContain(`alter column ${column} drop not null`);
  });

  it("keeps completeness enforcement in the existing submission service", () => {
    const service = readFileSync(path.resolve(__dirname, "marketplace.service.ts"), "utf8");
    for (const field of ["title", "propertyCategory", "propertyType", "askingPrice"]) expect(service).toContain(`\"${field}\"`);
    expect(service).toContain("validateListingSubmission");
  });
});
