import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (name: string) => readFileSync(path.resolve(__dirname, name), "utf8");
const listings = source("seller-listings-screen.tsx");
const editor = source("seller-draft-editor.tsx");
const client = source("../../lib/api/client.ts");

describe("Seller Web draft deletion integration", () => {
  it("shows the destructive action only in the DRAFT branch", () => {
    expect(listings).toMatch(/item\.status === "DRAFT"[\s\S]{0,240}Delete draft/);
    for (const status of ["LIVE", "IN_REVIEW", "REJECTED"]) expect(listings).not.toContain(`item.status === "${status}" ? <button`);
  });
  it("uses one secure DELETE and authoritative listing refetch", () => {
    expect(client).toContain("client.delete<ApiSuccess<{ propertyId: string; deleted: true }>>");
    expect(listings).toContain("customerApi.deleteSellerDraft(propertyId)");
    expect(listings).toContain('invalidateQueries({ queryKey: ["seller-marketplace-listings"] })');
    expect(listings).not.toMatch(/filter\([^\n]+deleteTarget/);
  });
  it("deletes from the editor only after confirmation and routes away on success", () => {
    expect(editor).toContain("<SellerDeleteDraftDialog");
    expect(editor).toContain("await writeQueue.current.catch");
    expect(editor).toContain('router.replace("/seller/listings")');
    expect(editor).toContain('removeQueries({ queryKey: ["seller-draft", id] })');
  });
});
