import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { approveMarketplacePropertySchema, rejectMarketplacePropertySchema } from "./admin-marketplace.validators";
const routes = readFileSync(path.resolve(__dirname, "admin-marketplace.routes.ts"), "utf8");
const service = readFileSync(path.resolve(__dirname, "admin-marketplace.service.ts"), "utf8");
describe("Admin Marketplace review boundaries", () => {
  it("protects every operation with isolated unrestricted Admin sessions", () => { expect(routes).toContain('router.use(adminSessionMiddleware, requireAdminRole("ADMIN", "SUPER_ADMIN"))'); expect(routes).not.toMatch(/customerSessionMiddleware|authMiddleware|requireVerifiedCustomer/); });
  it("mounts queue, detail, document access, approval, and rejection", () => { for (const route of ['router.get("/properties"', 'router.get("/properties/:propertyId"', 'documents/:documentId/access', 'properties/:propertyId/approve', 'properties/:propertyId/reject']) expect(routes).toContain(route); });
  it("takes reviewer identity from auth rather than input", () => { const controller = readFileSync(path.resolve(__dirname, "admin-marketplace.controller.ts"), "utf8"); expect(controller).toContain('req.user!.id, "APPROVE"'); expect(controller).toContain('req.user!.id, "REJECT"'); expect(approveMarketplacePropertySchema.safeParse({ reviewedBy: "client" }).success).toBe(false); expect(rejectMarketplacePropertySchema.safeParse({ reason: "Needs evidence", reviewedAt: new Date().toISOString() }).success).toBe(false); });
  it("requires bounded nonblank rejection feedback", () => { expect(rejectMarketplacePropertySchema.safeParse({ reason: "" }).success).toBe(false); expect(rejectMarketplacePropertySchema.safeParse({ reason: " valid " }).success).toBe(true); expect(rejectMarketplacePropertySchema.safeParse({ reason: "x".repeat(1001) }).success).toBe(false); });
  it("uses database filters, pagination, and deterministic queue ordering", () => { expect(service).toContain('.eq("marketplace_status", query.status)'); expect(service).toContain('.in("marketplace_status", reviewStatuses)'); expect(service).toContain('.order("marketplace_submitted_at", { ascending: true }).order("id", { ascending: true })'); expect(service).toContain('request.range(from, from + query.limit - 1)'); });
  it("keeps provider identifiers out of review detail", () => { expect(service).toContain('select("id,document_type,display_name,mime_type,size_bytes,created_at")'); expect(service).not.toMatch(/documentsResult\.data.*cloudinary_public_id/); });
  it("maps illegal and duplicate transitions to stable errors", () => { for (const code of ["LISTING_NOT_IN_REVIEW", "LISTING_ALREADY_REVIEWED", "LISTING_APPROVAL_FAILED", "LISTING_REJECTION_FAILED"]) expect(service).toContain(`"${code}"`); });
});
