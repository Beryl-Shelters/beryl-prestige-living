import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/202608170001_property_documents_foundation.sql"), "utf8");

describe("property documents migration", () => {
  it("adds private metadata to the canonical property domain without destructive changes", () => {
    expect(sql).toContain("create table if not exists public.property_documents");
    expect(sql).toContain("references public.properties(id)");
    for (const column of ["document_type", "display_name", "cloudinary_public_id", "cloudinary_resource_type", "mime_type", "size_bytes", "created_at", "updated_at"]) expect(sql).toContain(column);
    expect(sql).toContain("enable row level security");
    expect(sql).not.toMatch(/\bdrop\b/i);
    expect(sql).not.toContain("marketplace_properties");
    expect(sql).not.toMatch(/disable row level security/i);
  });
});
