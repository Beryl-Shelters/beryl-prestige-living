import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { approveMarketplacePropertySchema, rejectMarketplacePropertySchema } from "./admin-marketplace.validators";
import { adminMarketplaceQueueSchema } from "./admin-marketplace.validators";
import { adminMarketplaceQueueSchema } from "./admin-marketplace.validators";
const routes = readFileSync(path.resolve(__dirname, "admin-marketplace.routes.ts"), "utf8");
const service = readFileSync(path.resolve(__dirname, "admin-marketplace.service.ts"), "utf8");
describe("Admin Marketplace review boundaries", () => {
  it("protects every operation with isolated unrestricted Admin sessions", () => { expect(routes).toContain('router.use(adminSessionMiddleware, requireAdminRole("ADMIN", "SUPER_ADMIN"))'); expect(routes).not.toMatch(/customerSessionMiddleware|authMiddleware|requireVerifiedCustomer/); });
  it("mounts queue, detail, document access, approval, and rejection", () => { for (const route of ['router.get("/properties"', 'router.get("/properties/:propertyId"', 'documents/:documentId/access', 'properties/:propertyId/approve', 'properties/:propertyId/reject']) expect(routes).toContain(route); });
  it("takes reviewer identity from auth rather than input", () => { const controller = readFileSync(path.resolve(__dirname, "admin-marketplace.controller.ts"), "utf8"); expect(controller).toContain('req.user!.id, "APPROVE"'); expect(controller).toContain('req.user!.id, "REJECT"'); expect(approveMarketplacePropertySchema.safeParse({ reviewedBy: "client" }).success).toBe(false); expect(rejectMarketplacePropertySchema.safeParse({ reason: "Needs evidence", reviewedAt: new Date().toISOString() }).success).toBe(false); });
  it("requires bounded nonblank rejection feedback", () => { expect(rejectMarketplacePropertySchema.safeParse({ reason: "" }).success).toBe(false); expect(rejectMarketplacePropertySchema.safeParse({ reason: " valid " }).success).toBe(true); expect(rejectMarketplacePropertySchema.safeParse({ reason: "x".repeat(1001) }).success).toBe(false); });
  it("uses database filters, pagination, and deterministic queue ordering", () => { expect(service).toContain('.eq("marketplace_status", query.status)'); expect(service).toContain('.in("marketplace_status", reviewStatuses)'); expect(service).toContain('.order("marketplace_submitted_at", { ascending: true }).order("id", { ascending: true })'); expect(service).toContain('request.range(from, from + query.limit - 1)'); });
  it("validates the approved directory search, filters, and server sort options", () => {
    expect(adminMarketplaceQueueSchema.parse({ q: "  Ikoyi  ", category: "RESIDENTIAL", mandate: "EXCLUSIVE", sort: "PRICE_HIGH" })).toMatchObject({ q: "Ikoyi", category: "RESIDENTIAL", mandate: "EXCLUSIVE", sort: "PRICE_HIGH" });
    expect(adminMarketplaceQueueSchema.safeParse({ sort: "CLIENT_ONLY" }).success).toBe(false);
  });
  it("searches database fields and Seller identity while stripping PostgREST delimiters", () => { expect(service).toContain('safeSearch'); expect(service).toContain('replace(/[,%()]/g'); expect(service).toContain('sellerIdsMatching'); expect(service).toContain('property_code.ilike'); expect(service).toContain('public_location.ilike'); });
  it("filters category and mandate in the database", () => { expect(service).toContain('marketplaceCategoryToStorage(query.category)'); expect(service).toContain('.eq("mandates.marketplace_mandate_type", query.mandate)'); });
  it("supports price and recency sorts without weakening operational priority", () => { for (const field of ['query.sort === "PRICE_HIGH"', 'query.sort === "PRICE_LOW"', 'query.sort === "MOST_RECENT"', 'query.sort === "OLDEST"']) expect(service).toContain(field); expect(service).toContain('query.status === "IN_REVIEW"'); });
  it("validates the approved directory search, filters, and server sort options", () => {
    expect(adminMarketplaceQueueSchema.parse({ q: "  Ikoyi  ", category: "RESIDENTIAL", mandate: "EXCLUSIVE", sort: "PRICE_HIGH" })).toMatchObject({ q: "Ikoyi", category: "RESIDENTIAL", mandate: "EXCLUSIVE", sort: "PRICE_HIGH" });
    expect(adminMarketplaceQueueSchema.safeParse({ sort: "CLIENT_ONLY" }).success).toBe(false);
  });
  it("searches database fields and Seller identity while stripping PostgREST delimiters", () => { expect(service).toContain('safeSearch'); expect(service).toContain('replace(/[,%()]/g'); expect(service).toContain('sellerIdsMatching'); expect(service).toContain('property_code.ilike'); expect(service).toContain('public_location.ilike'); });
  it("filters category and mandate in the database", () => { expect(service).toContain('marketplaceCategoryToStorage(query.category)'); expect(service).toContain('.eq("mandates.marketplace_mandate_type", query.mandate)'); });
  it("supports price and recency sorts without weakening operational priority", () => { for (const field of ['query.sort === "PRICE_HIGH"', 'query.sort === "PRICE_LOW"', 'query.sort === "MOST_RECENT"', 'query.sort === "OLDEST"']) expect(service).toContain(field); expect(service).toContain('query.status === "IN_REVIEW"'); });
  it("keeps provider identifiers out of review detail", () => { expect(service).toContain('select("id,document_type,display_name,mime_type,size_bytes,created_at")'); expect(service).not.toMatch(/documentsResult\.data.*cloudinary_public_id/); });
  it("uses the canonical Seller verification timestamp", () => { expect(service).toContain("email_verified_at"); expect(service).not.toMatch(/email_verified(?:,|\))/); });
  it("maps illegal and duplicate transitions to stable errors", () => { for (const code of ["LISTING_NOT_IN_REVIEW", "LISTING_ALREADY_REVIEWED", "LISTING_APPROVAL_FAILED", "LISTING_REJECTION_FAILED"]) expect(service).toContain(`"${code}"`); });
});
