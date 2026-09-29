import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, type TestContext } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../src/app.js";
import { adminConfigSchema } from "../src/admin/config.js";
import type { AdminInvitationEmail } from "../src/admin/email.js";
import type { AdminIdentity } from "../src/admin/identity.js";
import type {
  AdminPaymentPreview,
  AdminPaymentResult,
  AdminReferrerDetail,
  AdminReferrerDirectoryPage,
  AdminReferrerQuery,
} from "../src/admin/referrers-model.js";
import type { AdminReferrersRepository } from "../src/admin/referrers-repository.js";
import type {
  AdminProfile,
  AdminRepository,
  InvitationClaim,
  InvitationPreview,
  InvitationRecord,
  StoredAdminSession,
} from "../src/admin/repository.js";
import { authConfigSchema } from "../src/auth/config.js";
import { unavailable } from "../src/auth/errors.js";
import type { ProviderTokens } from "../src/auth/gateway.js";
import type { MediaStorage } from "../src/listings/media.js";
import type { MediaAsset } from "../src/listings/model.js";
const auth = authConfigSchema.parse({
    webOrigin: "http://localhost:3000",
    apiOrigin: "http://localhost:4000",
    supabaseUrl: "https://example.supabase.co",
    anonKey: "anon",
    serviceKey: "service",
    encryptionKey: randomBytes(32).toString("base64"),
    cookieSecure: false,
    production: false,
    rateLimit: 100,
  }),
  adminConfig = adminConfigSchema.parse({
    appOrigin: "http://localhost:3001",
    resendApiKey: "test",
    inviteFrom: "Beryl <admin@example.test>",
    inviteSeconds: 172800,
    production: false,
  });
const adminId = "11111111-1111-4111-8111-111111111111",
  inactiveId = "22222222-2222-4222-8222-222222222222",
  referrerId = "33333333-3333-4333-8333-333333333333";
class Sessions implements AdminRepository {
  profiles = new Map<string, AdminProfile>([
    [
      adminId,
      {
        userId: adminId,
        fullName: "Finance Admin",
        email: "admin@example.test",
        phone: "+2348011111111",
        department: "MANAGEMENT",
        role: "ADMIN",
        active: true,
      },
    ],
    [
      inactiveId,
      {
        userId: inactiveId,
        fullName: "Inactive Admin",
        email: "inactive@example.test",
        phone: "+2348022222222",
        department: "TECH",
        role: "ADMIN",
        active: false,
      },
    ],
  ]);
  sessions = new Map<string, StoredAdminSession>();
  profile(id: string) {
    return Promise.resolve(this.profiles.get(id) ?? null);
  }
  reserve(): Promise<InvitationRecord> {
    throw unavailable();
  }
  provisionIdentity(): Promise<string> {
    throw unavailable();
  }
  attach(): Promise<void> {
    throw unavailable();
  }
  preview(): Promise<InvitationPreview> {
    throw unavailable();
  }
  claim(): Promise<InvitationClaim> {
    throw unavailable();
  }
  release(): Promise<void> {
    throw unavailable();
  }
  accept(): Promise<AdminProfile> {
    throw unavailable();
  }
  async createSession(
    hash: string,
    userId: string,
    tokens: string,
    seconds: number,
  ) {
    this.sessions.set(hash, {
      token_hash: hash,
      user_id: userId,
      encrypted_tokens: tokens,
      expires_at: new Date(Date.now() + seconds * 1000).toISOString(),
      refresh_lock: null,
    });
  }
  readSession(hash: string) {
    return Promise.resolve(this.sessions.get(hash) ?? null);
  }
  async claimRefresh(hash: string, lock: string) {
    const row = this.sessions.get(hash);
    if (row) row.refresh_lock = lock;
    return row ?? null;
  }
  async finishRefresh(hash: string, lock: string, tokens: string) {
    const row = this.sessions.get(hash);
    if (!row || row.refresh_lock !== lock) return false;
    row.encrypted_tokens = tokens;
    row.refresh_lock = null;
    return true;
  }
  async deleteSession(hash: string) {
    this.sessions.delete(hash);
  }
  async deleteUserSessions(id: string) {
    for (const [key, row] of this.sessions)
      if (row.user_id === id) this.sessions.delete(key);
  }
}
class Identity implements AdminIdentity {
  loginUser = adminId;
  createPending(): Promise<string> {
    throw unavailable();
  }
  deletePending(): Promise<void> {
    throw unavailable();
  }
  activate(): Promise<void> {
    throw unavailable();
  }
  login() {
    return Promise.resolve(this.tokens(this.loginUser));
  }
  validate() {
    return Promise.resolve();
  }
  refresh(tokens: ProviderTokens) {
    return Promise.resolve(tokens);
  }
  signOut() {
    return Promise.resolve();
  }
  tokens(userId: string): ProviderTokens {
    return {
      userId,
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: Date.now() / 1000 + 3600,
    };
  }
}
const page: AdminReferrerDirectoryPage = {
  summary: {
    referrers: 1,
    referrals: 2,
    completed: 1,
    outstandingMinor: 1000000,
  },
  counts: { all: 1, owed: 1, paid: 0 },
  items: [
    {
      id: referrerId,
      fullName: "Controlled Referrer",
      phone: "+2348033333333",
      referrals: 2,
      completed: 1,
      earnedMinor: 1000000,
      paidMinor: 0,
      outstandingMinor: 1000000,
      bankStatus: "ON_FILE",
    },
  ],
  page: 1,
  pageSize: 6,
  total: 1,
  totalPages: 1,
};
const detail: AdminReferrerDetail = {
  referrer: {
    id: referrerId,
    fullName: "Controlled Referrer",
    email: "referrer@example.test",
    phone: "+2348033333333",
  },
  summary: {
    referrals: 2,
    completed: 1,
    earnedMinor: 1000000,
    paidMinor: 0,
    outstandingMinor: 1000000,
  },
  bank: {
    status: "ON_FILE",
    accountName: "Controlled Referrer",
    bankName: "Test Bank",
    maskedAccountNumber: "••••••6789",
  },
  items: [],
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
};
class Referrers implements AdminReferrersRepository {
  queries: AdminReferrerQuery[] = [];
  payments = new Map<string, AdminPaymentResult>();
  records: {
    requestId: string;
    admin: string;
    commission: string;
    receipt: MediaAsset;
  }[] = [];
  directory(query: AdminReferrerQuery) {
    this.queries.push(query);
    return Promise.resolve(page);
  }
  detail() {
    return Promise.resolve(detail);
  }
  preview(_admin: string, commission: string): Promise<AdminPaymentPreview> {
    return Promise.resolve({
      commissionId: commission,
      referrerId,
      referrerName: "Controlled Referrer",
      referralCode: "REF-ABC234",
      amountMinor: 1000000,
      accountName: "Controlled Referrer",
      bankName: "Test Bank",
      accountNumber: "0123456789",
    });
  }
  record(
    requestId: string,
    admin: string,
    commission: string,
    receipt: MediaAsset,
  ): Promise<AdminPaymentResult> {
    this.records.push({ requestId, admin, commission, receipt });
    const payment = {
      paymentId: "PAY-ABC234",
      commissionId: commission,
      referrerId,
      amountMinor: 1000000,
      paidAt: new Date().toISOString(),
    };
    this.payments.set(requestId, payment);
    return Promise.resolve(payment);
  }
  byRequest(_admin: string, requestId: string) {
    return Promise.resolve(this.payments.get(requestId) ?? null);
  }
  receipt() {
    return Promise.resolve({
      public_id: "private/receipt.pdf",
      resource_type: "raw",
      delivery_type: "authenticated",
      url: "",
      mime_type: "application/pdf",
      size_bytes: 9,
    });
  }
}
class Storage implements MediaStorage {
  uploads = 0;
  downloads = 0;
  async upload(
    file: Parameters<MediaStorage["upload"]>[0],
    asset: Parameters<MediaStorage["upload"]>[1],
  ) {
    this.uploads++;
    return {
      ...asset,
      url: "",
      mime_type: file.mime,
      size_bytes: file.bytes.length,
    };
  }
  remove() {
    return Promise.resolve();
  }
  async download() {
    this.downloads++;
    return Buffer.from("%PDF-test");
  }
}
const email: AdminInvitationEmail = {
  send() {
    throw unavailable();
  },
};
async function fixture(t: TestContext) {
  const sessions = new Sessions(),
    identity = new Identity(),
    referrers = new Referrers(),
    storage = new Storage(),
    server = createApp({
      webAppUrl: auth.webOrigin,
      auth,
      admin: adminConfig,
      adminRepository: sessions,
      adminReferrersRepository: referrers,
      adminIdentity: identity,
      adminEmail: email,
      mediaStorage: storage,
    }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  t.after(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  );
  const address = server.address();
  assert(address && typeof address !== "string");
  const jar = new Map<string, string>();
  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/admin${path}`,
      {
        ...init,
        headers: {
          Origin: adminConfig.appOrigin,
          Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; "),
          ...init.headers,
        },
      },
    );
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";"),
        index = pair!.indexOf("="),
        key = pair!.slice(0, index),
        value = pair!.slice(index + 1);
      if (value) jar.set(key, value);
      else jar.delete(key);
    }
    return response;
  }
  async function login(id: string) {
    identity.loginUser = id;
    return request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@example.test",
        password: "Controlled!9",
      }),
    });
  }
  return { referrers, storage, request, login };
}
test("Admin Referrers endpoints require active Admin auth and validate bounded queries", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request("/referrers")).status, 401);
  assert.equal((await f.login(inactiveId)).status, 401);
  await f.login(adminId);
  assert.equal(
    (
      await f.request(
        "/referrers?search=Ada&filter=OWED&sort=OUTSTANDING_DESC&page=2&pageSize=6",
      )
    ).status,
    200,
  );
  assert.deepEqual(f.referrers.queries[0], {
    search: "Ada",
    filter: "OWED",
    sort: "OUTSTANDING_DESC",
    page: 2,
    pageSize: 6,
  });
  assert.equal((await f.request("/referrers?filter=ZERO")).status, 400);
});
test("payment accepts only valid private receipt evidence and derives financial values server-side", async (t) => {
  const f = await fixture(t);
  await f.login(adminId);
  const invalid = new FormData();
  invalid.set(
    "data",
    JSON.stringify({ requestId: crypto.randomUUID(), amountMinor: 1 }),
  );
  invalid.set(
    "receipt",
    new Blob(["MZ bad"], { type: "application/pdf" }),
    "receipt.pdf",
  );
  assert.equal(
    (
      await f.request("/referrers/commissions/COM-ABC234/payment", {
        method: "POST",
        body: invalid,
      })
    ).status,
    400,
  );
  const injected = new FormData();
  injected.set(
    "data",
    JSON.stringify({ requestId: crypto.randomUUID(), amountMinor: 1 }),
  );
  injected.set(
    "receipt",
    new Blob(["%PDF-test"], { type: "application/pdf" }),
    "receipt.pdf",
  );
  assert.equal(
    (
      await f.request("/referrers/commissions/COM-ABC234/payment", {
        method: "POST",
        body: injected,
      })
    ).status,
    400,
  );
  const requestId = crypto.randomUUID(),
    valid = new FormData();
  valid.set("data", JSON.stringify({ requestId }));
  valid.set(
    "receipt",
    new Blob(["%PDF-test"], { type: "application/pdf" }),
    "receipt.pdf",
  );
  assert.equal(
    (
      await f.request("/referrers/commissions/COM-ABC234/payment", {
        method: "POST",
        body: valid,
      })
    ).status,
    201,
  );
  assert.equal(f.referrers.records.length, 1);
  assert.equal(f.referrers.records[0]!.admin, adminId);
  assert.equal(f.referrers.records[0]!.commission, "COM-ABC234");
  assert.equal(f.storage.uploads, 1);
  const retry = new FormData();
  retry.set("data", JSON.stringify({ requestId }));
  retry.set(
    "receipt",
    new Blob(["%PDF-test"], { type: "application/pdf" }),
    "receipt.pdf",
  );
  assert.equal(
    (
      await f.request("/referrers/commissions/COM-ABC234/payment", {
        method: "POST",
        body: retry,
      })
    ).status,
    201,
  );
  assert.equal(f.storage.uploads, 1);
  assert.equal(f.referrers.records.length, 1);
});
test("private payout receipts require Admin authorization", async (t) => {
  const f = await fixture(t);
  assert.equal(
    (await f.request("/referrers/payments/PAY-ABC234/receipt")).status,
    401,
  );
  await f.login(adminId);
  const response = await f.request("/referrers/payments/PAY-ABC234/receipt");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(f.storage.downloads, 1);
});

test("payout migration aggregates canonically, records exactly once, and updates customer financial truth", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const buyer = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    referrer = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    zero = "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    seller = "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    admin = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    listing = "10000000-0000-4000-8000-000000000001",
    purchase = "20000000-0000-4000-8000-000000000001",
    requestId = "30000000-0000-4000-8000-000000000001";
  await db.exec(
    "create schema auth;create function auth.uid() returns uuid language sql stable as 'select null::uuid';create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');create role anon;create role authenticated;create role service_role bypassrls;",
  );
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'buyer@example.test',now()),($2,'referrer@example.test',now()),($3,'zero@example.test',now()),($4,'seller@example.test',now()),($5,'admin@example.test',now())",
    [buyer, referrer, zero, seller, admin],
  );
  for (const name of [
    "202609060001_customer_auth_foundation.sql",
    "202609080001_customer_listings.sql",
    "202609100001_short_display_codes.sql",
    "202609130001_customer_referrals.sql",
    "202609140001_customer_settings_profile.sql",
    "202609270002_customer_completed_purchases.sql",
    "202609270003_admin_invitations.sql",
    "202609280003_referral_commission_foundation.sql",
    "202609280004_admin_referral_payouts.sql",
  ])
    await db.exec(
      await readFile(
        new URL(`../supabase/migrations/${name}`, import.meta.url),
        "utf8",
      ),
    );
  const profile =
    "insert into customer_profiles(id,first_name,last_name,email,country_code,phone_number,phone_number_normalized,account_type,profile_type,email_verified_at,bank_account_name,bank_name,bank_account_number) values($1,$2,'Test',$3,'+234',$4,$5,'INVESTOR','PERSONAL',now(),$6,$7,$8)";
  await db.query(profile, [
    buyer,
    "Buyer",
    "buyer@example.test",
    "8011111111",
    "+2348011111111",
    null,
    null,
    null,
  ]);
  await db.query(profile, [
    referrer,
    "Referrer",
    "referrer@example.test",
    "8022222222",
    "+2348022222222",
    "Referrer Test",
    "Test Bank",
    "0123456789",
  ]);
  await db.query(profile, [
    zero,
    "Zero",
    "zero@example.test",
    "8033333333",
    "+2348033333333",
    null,
    null,
    null,
  ]);
  await db.query(profile, [
    seller,
    "Seller",
    "seller@example.test",
    "8044444444",
    "+2348044444444",
    null,
    null,
    null,
  ]);
  await db.query(
    "insert into admin_profiles(user_id,full_name,email,phone_normalized,department,admin_role,active,accepted_at) values($1,'Finance Admin','admin@example.test','+2348055555555','MANAGEMENT','ADMIN',true,now())",
    [admin],
  );
  await db.query(
    "insert into customer_listings(id,user_id,listing_code,title,description,occupancy_type,ownership_type,property_type,property_subtype,has_lien,bedrooms,bathrooms,parking_spaces,facilities,property_cost_minor,minimum_down_payment_minor,location,state,city,listing_status) values($1,$2,'RES-ABC234','Controlled','Controlled','Residential','Personal','Residential','Bungalow',false,3,2,1,'{}',50000001,5000000,'Address','Lagos','Ikeja','LISTED')",
    [listing, seller],
  );
  await db.query(
    "insert into customer_referral_links(user_id,referral_code,referral_type,listing_id,property_code,created_at) values($1,'REF-ABC234','PROPERTY',$2,'RES-ABC234','2026-09-01'),($3,'REF-ZER234','PROPERTY',$2,'RES-ABC234','2026-09-02')",
    [referrer, listing, zero],
  );
  await db.query(
    "select record_admin_completed_purchase($1,$2,$3,'RES-ABC234',50000001,'2026-09-20','REF-ABC234')",
    [purchase, admin, buyer],
  );
  type Directory = {
    summary: {
      referrers: number;
      referrals: number;
      completed: number;
      outstandingMinor: number;
    };
    counts: { all: number; owed: number; paid: number };
    items: { id: string; earnedMinor: number; outstandingMinor: number }[];
  };
  let directory = (
    await db.query<{ value: Directory }>(
      "select list_admin_referrers('','ALL','NEWEST',1,6) value",
    )
  ).rows[0]!.value;
  assert.deepEqual(directory.summary, {
    referrers: 2,
    referrals: 2,
    completed: 1,
    outstandingMinor: 1000000,
  });
  assert.equal(directory.items.length, 2);
  assert.equal(
    (
      await db.query<{ value: Directory }>(
        "select list_admin_referrers('Referrer','ALL','NEWEST',1,6) value",
      )
    ).rows[0]!.value.total,
    1,
  );
  assert.equal(
    (
      await db.query<{ value: Directory }>(
        "select list_admin_referrers('802222','ALL','NEWEST',1,6) value",
      )
    ).rows[0]!.value.total,
    1,
  );
  assert.equal(
    (
      await db.query<{ value: Directory }>(
        "select list_admin_referrers('','PAID','NEWEST',1,6) value",
      )
    ).rows[0]!.value.total,
    0,
    "zero-earned referrers are not fully paid",
  );
  const financialSnapshot = async () => ({
    purchase: (
      await db.query(
        "select id,customer_id,source_listing_id,property_code,price_minor,closed_at,recorded_by from customer_completed_purchases order by id",
      )
    ).rows,
    attribution: (
      await db.query(
        "select id,completed_purchase_id,referral_link_id,referrer_id,referred_customer_id,referral_code,referral_type from completed_purchase_referral_attributions order by id",
      )
    ).rows,
    entitlement: (
      await db.query(
        "select id,public_id,attribution_id,completed_purchase_id,referral_link_id,referrer_id,commission_basis_minor,commission_rate_bps,commission_amount_minor,earned_at from referral_commission_entitlements order by id",
      )
    ).rows,
    links: (
      await db.query(
        "select id,user_id,referral_code,referral_type,listing_id,property_code from customer_referral_links order by id",
      )
    ).rows,
    listing: (
      await db.query(
        "select id,user_id,listing_status,property_cost_minor from customer_listings order by id",
      )
    ).rows,
  });
  const beforePayout = await financialSnapshot();
  const commission = (
    await db.query<{ public_id: string }>(
      "select public_id from referral_commission_entitlements",
    )
  ).rows[0]!.public_id;
  const preview = (
    await db.query<{ value: { amountMinor: number; accountNumber: string } }>(
      "select read_admin_referral_payment_preview($1,$2) value",
      [admin, commission],
    )
  ).rows[0]!.value;
  assert.equal(preview.amountMinor, 1000000);
  assert.equal(preview.accountNumber, "0123456789");
  const receipt = `beryl-v2/referral-payouts/${commission}/${requestId}.pdf`,
    record =
      "select record_admin_referral_payout($1,$2,$3,$4,'raw','authenticated','application/pdf',9) value";
  const args = [requestId, admin, commission, receipt],
    first = (await db.query<{ value: AdminPaymentResult }>(record, args))
      .rows[0]!.value,
    retry = (await db.query<{ value: AdminPaymentResult }>(record, args))
      .rows[0]!.value;
  assert.deepEqual(retry, first);
  const duplicateId = crypto.randomUUID();
  await assert.rejects(
    db.query(record, [
      duplicateId,
      admin,
      commission,
      `beryl-v2/referral-payouts/${commission}/${duplicateId}.pdf`,
    ]),
    /already paid/,
  );
  assert.equal(
    (
      await db.query<{ count: number }>(
        "select count(*)::integer count from referral_commission_payouts",
      )
    ).rows[0]!.count,
    1,
  );
  directory = (
    await db.query<{ value: Directory }>(
      "select list_admin_referrers('','ALL','NEWEST',1,6) value",
    )
  ).rows[0]!.value;
  assert.equal(directory.summary.outstandingMinor, 0);
  assert.equal(directory.counts.paid, 1);
  const customer = (
    await db.query<{
      value: {
        summary: {
          availableBalance: number;
          totalEarnings: number;
          referrals: number;
          propertiesSold: number;
        };
        items: { paymentState: string }[];
      };
    }>("select list_customer_referrals($1,1,10) value", [referrer])
  ).rows[0]!.value;
  assert.deepEqual(customer.summary, {
    availableBalance: 0,
    totalEarnings: 1000000,
    referrals: 1,
    propertiesSold: 1,
  });
  assert.equal(customer.items[0]!.paymentState, "PAID");
  assert.deepEqual(
    await financialSnapshot(),
    beforePayout,
    "payout must not mutate purchases, attribution, earned commission, referral links, or listing lifecycle",
  );
  assert.equal(
    (
      await db.query<{ amount: number }>(
        "select commission_amount_minor amount from referral_commission_entitlements",
      )
    ).rows[0]!.amount,
    1000000,
  );
  await assert.rejects(
    db.query("delete from referral_commission_payouts"),
    /immutable/,
  );
  await db.exec("set role authenticated");
  await assert.rejects(db.query("select * from referral_commission_payouts"));
  await assert.rejects(
    db.query("select list_admin_referrers('','ALL','NEWEST',1,6)"),
  );
  await db.exec("reset role");
});
