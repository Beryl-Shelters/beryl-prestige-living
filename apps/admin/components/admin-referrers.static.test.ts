import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd().endsWith("apps\\admin") || process.cwd().endsWith("apps/admin") ? process.cwd() : join(process.cwd(), "apps", "admin");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const directory = source("components/admin-referrers-directory.tsx");
const detail = source("components/admin-referrer-detail.tsx");
const shell = source("components/admin-dashboard.tsx");
const shared = source("app/api/admin/_shared.ts");
const contracts = source("lib/contracts.ts");

describe("Admin Referrer UI architecture", () => {
  it("places Referrers after Leads and before Super Admin management", () => {
    expect(shell.indexOf(">Leads<")).toBeLessThan(shell.indexOf(">Referrers<"));
    expect(shell.indexOf(">Referrers<")).toBeLessThan(shell.indexOf(">Admin Management<"));
  });
  it("matches the PDF directory heading, metrics, tabs, and columns", () => {
    ["Everyone who has sent Beryl a referral, and what they’re owed.", "Referrers", "Referrals", "Completed", "Outstanding", "Owed Money", "Fully Paid", "Earned", "Bank Details"].forEach((copy) => expect(directory).toContain(copy));
  });
  it("uses server search, payment filters, sort, and pagination", () => {
    ["URLSearchParams", "payment", "sort", "page", "limit", "q"].forEach((value) => expect(directory).toContain(value));
  });
  it("supports loading, failure/retry, filtered empty, and first-use empty states", () => {
    ["Loading user", "Try again", "No referrers match these filters", "No referrers yet", "Registered referrers will appear here"].filter((value) => value !== "Loading user").forEach((value) => expect(directory).toContain(value));
    expect(directory).toContain("referrer-row-skeleton");
  });
  it("uses canonical UUID routes and preserves customer navigation only when linked", () => {
    expect(directory).toContain("/dashboard/referrers/${item.id}");
    expect(detail).toContain("detail.linkedCustomer ?"); expect(detail).toContain("/dashboard/users/${detail.linkedCustomer.id}");
  });
  it("shows masked ordinary payout detail and a protected on-demand payment modal", () => {
    expect(detail).toContain("maskedAccountNumber"); expect(detail).not.toContain("account_number_ciphertext");
    expect(detail).toContain("payment-preparation"); expect(detail).toContain("Record this payment");
  });
  it("requires PDF/PNG/JPEG up to 10MB and sends multipart without an amount", () => {
    ["application/pdf", "image/png", "image/jpeg", "10 * 1024 * 1024", 'form.set("receipt", file)'].forEach((value) => expect(detail).toContain(value));
    expect(detail).not.toMatch(/form\.set\(["']amount/);
  });
  it("does not optimistically mark paid and refetches after server confirmation", () => {
    expect(detail).toContain("if (!response.ok)"); expect(detail).toContain("void load().then(() => setSuccess(true))");
    expect(detail).not.toMatch(/paymentStatus\s*=(?!=)|setDetail\([^)]*PAID/);
  });
  it("supports keyboard dismissal, backdrop dismissal, labels, and pending states", () => {
    expect(detail).toContain('event.key === "Escape"'); expect(detail).toContain("aria-modal=\"true\""); expect(detail).toContain("aria-labelledby"); expect(detail).toContain("pending");
  });
  it("exposes paid receipt access only through the Admin BFF", () => {
    expect(detail).toContain("payment/receipt/access"); expect(detail).toContain("View Receipt"); expect(detail).not.toMatch(/cloudinary|receipt_storage_public_id/i);
  });
  it("forwards multipart through the existing HttpOnly Admin refresh architecture", () => {
    expect(shared).toContain("protectedAdminMultipartRequest"); expect(shared).toContain("ADMIN_COOKIES.access"); expect(shared).toContain("admin/auth/refresh");
    expect(shared).not.toMatch(/localStorage|sessionStorage/);
  });
  it("defines bounded safe directory, detail, and payment contracts", () => {
    ["AdminReferrerDirectory", "AdminReferrerDetail", "AdminReferralPaymentPreparation"].forEach((name) => expect(contracts).toContain(name));
    expect(contracts).not.toContain("receiptStoragePublicId");
  });
});
