import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { adminPropertyFromLeadPath, adminPropertyPath, safeAdminPropertyReturnPath } from "@/lib/admin-routes";

const root = process.cwd().endsWith("apps\\admin") || process.cwd().endsWith("apps/admin") ? process.cwd() : join(process.cwd(), "apps", "admin");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const lead = source("components/admin-lead-detail.tsx");
const detail = source("components/admin-property-detail.tsx");
const page = source("app/dashboard/properties/[propertyId]/page.tsx");
const propertyBff = source("app/api/admin/marketplace/properties/[propertyId]/route.ts");
const documentBff = source("app/api/admin/marketplace/properties/[propertyId]/documents/[documentId]/access/route.ts");
const shell = source("components/admin-dashboard.tsx");

describe("protected Admin property detail from Leads", () => {
  const propertyId = "11111111-1111-4111-8111-111111111111";
  const leadId = "22222222-2222-4222-8222-222222222222";
  it("renders the enabled View property action", () => { expect(lead).toContain(">View property</Link>"); expect(lead).not.toContain("View property unavailable"); });
  it("builds navigation with canonical property and lead UUIDs", () => expect(adminPropertyFromLeadPath(propertyId, leadId)).toBe(`/dashboard/properties/${propertyId}?returnTo=${encodeURIComponent(`/dashboard/leads/${leadId}`)}`));
  it("centralizes the canonical Admin property route", () => expect(adminPropertyPath(propertyId)).toBe(`/dashboard/properties/${propertyId}`));
  it("enters a protected App Router page", () => { expect(page).toContain("requireAdminSession()"); expect(page).toContain("AdminPropertyDetailScreen"); });
  it("renders the property header and lifecycle status", () => { expect(detail).toContain("property-detail-header"); expect(detail).toContain("summary.status"); expect(detail).toContain("Property {summary.referenceId}"); });
  it("renders supported operational property details", () => ["Private address", "Category", "Property type", "Condition", "Furnishing", "Bedrooms", "Bathrooms", "Toilets", "Parking spaces"].forEach((label) => expect(detail).toContain(label)));
  it("renders ordered media without provider identifiers", () => { expect(detail).toContain("property.images.map"); expect(detail).toContain("summary.photoCount"); expect(detail).not.toMatch(/cloudinary|publicId|signature/); });
  it("renders Seller information", () => { expect(detail).toContain("Seller"); expect(detail).toContain("seller.fullName"); expect(detail).toContain("seller.emailVerified"); });
  it("renders mandate state", () => { expect(detail).toContain("Sales mandate"); expect(detail).toContain("mandate.ownershipConfirmed"); expect(detail).toContain("mandate.mandateAccepted"); });
  it("renders lifecycle fields and feedback safely", () => ["summary.submittedAt", "summary.reviewedAt", "summary.publishedAt", "summary.rejectedAt", "review.rejectionFeedback"].forEach((field) => expect(detail).toContain(field)));
  it("requests document access only after an explicit click", () => { expect(detail).toContain("onClick={() => void openDocument(document.id)}"); expect(documentBff).toContain("documents/${encodeURIComponent(documentId)}/access"); expect(detail).not.toContain("document.url"); });
  it("allows only a Lead detail return path", () => { expect(safeAdminPropertyReturnPath(`/dashboard/leads/${leadId}`)).toBe(`/dashboard/leads/${leadId}`); expect(safeAdminPropertyReturnPath("https://evil.example/path")).toBe("/dashboard/leads"); expect(safeAdminPropertyReturnPath("/dashboard/properties/other")).toBe("/dashboard/leads"); });
  it("renders an intentional retryable missing/error state", () => { expect(detail).toContain("Property could not be loaded."); expect(detail).toContain("Try again"); });
  it("forwards property detail through the protected Admin BFF", () => { expect(propertyBff).toContain("protectedAdminRequest"); expect(propertyBff).toContain("admin/marketplace/properties/${encodeURIComponent"); });
  it("marks Properties active without changing the approved sidebar", () => { expect(shell).toContain('pathname.startsWith("/dashboard/properties")'); ["Dashboard", "Users", "Properties", "Leads", "Settings"].forEach((label) => expect(shell).toContain(label)); });
  it("preserves Lead detail and stage behavior", () => { expect(lead).toContain('transition("CONTACTED")'); expect(lead).toContain('transition("WON")'); expect(lead).toContain('transition("LOST")'); });
});
