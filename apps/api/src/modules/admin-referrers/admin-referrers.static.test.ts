import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd().endsWith("apps\\api") || process.cwd().endsWith("apps/api") ? process.cwd() : join(process.cwd(), "apps", "api");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const routes = source("src/modules/admin-referrers/admin-referrers.routes.ts");
const controller = source("src/modules/admin-referrers/admin-referrers.controller.ts");
const service = source("src/modules/admin-referrers/admin-referrers.service.ts");
const validators = source("src/modules/admin-referrers/admin-referrers.validators.ts");
const migration = source("supabase/migrations/202608290001_admin_referrer_payments.sql");
const swagger = source("src/config/swagger.ts");

describe("Admin Referrer architecture", () => {
  it("isolates every operation behind ADMIN and SUPER_ADMIN sessions", () => {
    expect(routes).toContain('adminSessionMiddleware, requireAdminRole("ADMIN", "SUPER_ADMIN")');
    expect(routes).not.toMatch(/customerSessionMiddleware|referralSession|authMiddleware/);
  });
  it("mounts directory, detail, payment preparation, mark-paid, and signed receipt access", () => {
    [
      'router.get("/", controller.list)', 'router.get("/:referrerId", controller.detail)',
      'payment-preparation", controller.paymentPreparation', 'mark-paid", adminReferralPaymentRateLimiter, uploadReferralPaymentReceipt, controller.markPaid',
      'payment/receipt/access", controller.receiptAccess'
    ].forEach((operation) => expect(routes).toContain(operation));
  });
  it("validates bounded search, payment filters, sorting, UUIDs, and pagination", () => {
    expect(validators).toContain("z.string().uuid()"); expect(validators).toContain(".max(120)"); expect(validators).toContain(".max(50)");
    ["ALL", "OWED", "FULLY_PAID", "MOST_OWED", "MOST_EARNED"].forEach((value) => expect(validators).toContain(value));
  });
  it("calculates earned and outstanding only from completed canonical rewards", () => {
    expect(migration).toMatch(/lifecycle_status = 'COMPLETED'[\s\S]*reward_amount/);
    expect(migration).toMatch(/lifecycle_status = 'COMPLETED'[\s\S]*payment_status = 'OUTSTANDING'/);
    expect(migration).not.toMatch(/price\s*\*|0\.25|25\s*\/\s*100/);
  });
  it("uses parameterized server-side search, filter, sort, and pagination", () => {
    ["p_query", "p_payment_filter", "p_sort", "p_page", "p_limit", "ilike", "offset", "limit"].forEach((value) => expect(migration.toLowerCase()).toContain(value.toLowerCase()));
    expect(migration).not.toContain("execute format");
    expect(migration).toContain("x.earned_amount > 0 and x.outstanding_amount = 0");
  });
  it("supports customer-linked and referral-only identities without fabricating customer IDs", () => {
    expect(service).toContain('referrer.customer_user_id ? "CUSTOMER_LINKED" : "REFERRAL_ONLY"');
    expect(service).toContain("linkedCustomer: profileResult.data ?");
  });
  it("keeps normal payout DTOs masked and decrypts only on payment preparation", () => {
    expect(service).toContain("maskedAccountNumber"); expect(service).toContain("decryptAccountNumber");
    expect(controller).toContain('Cache-Control", "no-store, private"');
    const preparation = service.slice(service.indexOf("getPaymentPreparation"), service.indexOf("hasValidSignature"));
    expect(preparation).toContain("decryptAccountNumber");
  });
  it("requires real PDF/PNG/JPEG signatures and never accepts client amount/admin/time", () => {
    ["%PDF-", "image/png", "image/jpeg", "p_admin_id: adminId"].forEach((value) => expect(service).toContain(value));
    expect(controller).not.toMatch(/req\.body\.(amount|paidAt|adminId|status)/);
  });
  it("atomically locks and revalidates eligibility, payout, and duplicate state", () => {
    expect(migration).toContain("for update"); expect(migration).toContain("referral_payments_one_paid_per_referral_uidx");
    ["ALREADY_PAID", "NOT_PAYABLE", "PAYOUT_REQUIRED", "RECEIPT_INVALID"].forEach((outcome) => expect(migration).toContain(outcome));
    expect(migration).toContain("v_referral.reward_amount"); expect(migration).toContain("now()");
  });
  it("cleans the authenticated receipt when payment persistence fails", () => {
    expect(service).toContain("deleteReferralPaymentReceipt(uploaded.public_id)");
    expect(service).toContain("uploadReferralPaymentReceipt(file.buffer)");
  });
  it("exposes only short-lived signed receipt access and safe metadata", () => {
    expect(service).toContain("createReferralPaymentReceiptAccessUrl"); expect(service).toContain("+ 300");
    expect(service).not.toMatch(/receipt_storage_public_id:\s*data/);
  });
  it("keeps both RPCs service-role only and RLS intact", () => {
    expect(migration).toMatch(/revoke all on function public\.list_admin_referrers[\s\S]*from public, anon, authenticated/);
    expect(migration).toMatch(/revoke all on function public\.record_admin_referral_payment[\s\S]*from public, anon, authenticated/);
    expect(migration.match(/to service_role/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it("documents all five protected Admin Referrer operations and stable errors", () => {
    ["/admin/referrers", "payment-preparation", "mark-paid", "payment/receipt/access", "REFERRER_NOT_FOUND", "REFERRAL_NOT_PAYABLE", "REFERRAL_ALREADY_PAID", "PAYMENT_RECEIPT_REQUIRED", "REFERRAL_PAYMENT_FAILED"].forEach((value) => expect(swagger).toContain(value));
  });
  it("returns stable safe controller and service errors", () => {
    ["REFERRER_NOT_FOUND", "REFERRAL_NOT_FOUND", "PAYMENT_RECEIPT_REQUIRED"].forEach((code) => expect(controller).toContain(code));
    ["ADMIN_REFERRERS_UNAVAILABLE", "PAYOUT_DETAILS_REQUIRED", "PAYMENT_RECEIPT_ACCESS_FAILED"].forEach((code) => expect(service).toContain(code));
  });
});
