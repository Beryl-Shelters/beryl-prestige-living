import { readFileSync } from "node:fs";
import path from "node:path";

const source = (name: string) => readFileSync(path.resolve(__dirname, name), "utf8");
const api = source("api/seller-marketplace.ts");
const listings = source("components/seller-marketplace/seller-listings-screen.tsx");
const editor = source("components/seller-marketplace/seller-editor-screen.tsx");

describe("mobile Seller draft deletion", () => {
  it("exposes Delete only for a DRAFT row", () => {
    expect(listings).toMatch(/item\.status === "DRAFT"[\s\S]{0,400}Delete draft/);
    expect(listings).not.toMatch(/item\.status === "(?:LIVE|IN_REVIEW|REJECTED)"[\s\S]{0,120}Delete draft/);
  });
  it("requires native confirmation with Cancel and a destructive action", () => {
    expect(listings).toContain('Alert.alert("Delete this draft?"');
    expect(listings).toContain('{ text: "Cancel", style: "cancel" }');
    expect(listings).toContain('{ text: "Delete draft", style: "destructive"');
    expect(editor).toContain('Alert.alert("Delete this draft?"');
  });
  it("uses the authenticated DELETE request and prevents duplicate row requests", () => {
    expect(api).toContain('r<{propertyId:string;deleted:true}>(`${root}/${id}`,"DELETE")');
    expect(listings).toContain("if (item.status !== \"DRAFT\" || deletingId) return");
    expect(listings).toContain("disabled={deleting}");
  });
  it("refetches authoritative counts and preserves a failed draft", () => {
    expect(listings).toContain('invalidateQueries({ queryKey: ["mobile-seller-listings"] })');
    expect(listings).toContain("We could not delete this draft. Please try again.");
    expect(listings).not.toMatch(/setItems|filter\([^\n]+item\.id/);
  });
  it("removes deleted editor queries and routes to My Listings only after success", () => {
    expect(editor).toContain('removeQueries({ queryKey: ["mobile-seller-draft", propertyId] })');
    expect(editor).toContain('router.replace("/seller/listings")');
    expect(editor.indexOf("await deleteSellerDraft")).toBeLessThan(editor.indexOf('router.replace("/seller/listings")'));
  });
});
