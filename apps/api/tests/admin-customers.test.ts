import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, type TestContext } from "node:test";

import { PGlite } from "@electric-sql/pglite";

import { createApp } from "../src/app.js";
import { adminConfigSchema } from "../src/admin/config.js";
import type { AdminInvitationEmail } from "../src/admin/email.js";
import type { AdminIdentity } from "../src/admin/identity.js";
import type { AdminCustomerDetail, AdminCustomerDirectoryPage, AdminCustomerDirectoryQuery } from "../src/admin/customers-model.js";
import type { AdminCustomersRepository } from "../src/admin/customers-repository.js";
import type { AdminProfile, AdminRepository, InvitationClaim, InvitationPreview, InvitationRecord, StoredAdminSession } from "../src/admin/repository.js";
import { authConfigSchema } from "../src/auth/config.js";
import { AuthError, unavailable } from "../src/auth/errors.js";
import type { ProviderTokens } from "../src/auth/gateway.js";

const auth = authConfigSchema.parse({ webOrigin: "http://localhost:3000", apiOrigin: "http://localhost:4000", supabaseUrl: "https://example.supabase.co", anonKey: "anon", serviceKey: "service", encryptionKey: randomBytes(32).toString("base64"), cookieSecure: false, production: false, rateLimit: 100 });
const adminConfig = adminConfigSchema.parse({ appOrigin: "http://localhost:3001", resendApiKey: "test", inviteFrom: "Beryl <admin@example.com>", inviteSeconds: 172800, production: false });
const superId = "11111111-1111-4111-8111-111111111111";
const adminId = "22222222-2222-4222-8222-222222222222";
const inactiveId = "33333333-3333-4333-8333-333333333333";
const nonAdminId = "44444444-4444-4444-8444-444444444444";

class SessionRepository implements AdminRepository {
  profiles = new Map<string, AdminProfile>([
    [superId, { userId: superId, fullName: "Super Admin", email: "super@example.test", phone: "+2348031234567", department: "MANAGEMENT", role: "SUPER_ADMIN", active: true }],
    [adminId, { userId: adminId, fullName: "Regular Admin", email: "admin@example.test", phone: "+2348031234568", department: "TECH", role: "ADMIN", active: true }],
    [inactiveId, { userId: inactiveId, fullName: "Inactive Admin", email: "inactive@example.test", phone: "+2348031234569", department: "TECH", role: "ADMIN", active: false }],
  ]);
  sessions = new Map<string, StoredAdminSession>();
  async profile(userId: string) { return this.profiles.get(userId) ?? null; }
  async reserve(): Promise<InvitationRecord> { throw unavailable(); }
  async provisionIdentity(): Promise<string> { throw unavailable(); }
  async attach(): Promise<void> { throw unavailable(); }
  async preview(): Promise<InvitationPreview> { throw unavailable(); }
  async claim(): Promise<InvitationClaim> { throw unavailable(); }
  async release(): Promise<void> { throw unavailable(); }
  async accept(): Promise<AdminProfile> { throw unavailable(); }
  async createSession(hash: string, userId: string, tokens: string, seconds: number) { this.sessions.set(hash, { token_hash: hash, user_id: userId, encrypted_tokens: tokens, expires_at: new Date(Date.now() + seconds * 1000).toISOString(), refresh_lock: null }); }
  async readSession(hash: string) { return this.sessions.get(hash) ?? null; }
  async claimRefresh(hash: string, lock: string) { const row = this.sessions.get(hash); if (!row) return null; row.refresh_lock = lock; return row; }
  async finishRefresh(hash: string, lock: string, tokens: string) { const row = this.sessions.get(hash); if (!row || row.refresh_lock !== lock) return false; row.encrypted_tokens = tokens; row.refresh_lock = null; return true; }
  async deleteSession(hash: string) { this.sessions.delete(hash); }
  async deleteUserSessions(userId: string) { for (const [hash, row] of this.sessions) if (row.user_id === userId) this.sessions.delete(hash); }
}

class Identity implements AdminIdentity {
  loginUser = superId;
  async createPending(): Promise<string> { throw unavailable(); }
  async deletePending(): Promise<void> { throw unavailable(); }
  async activate(): Promise<void> { throw unavailable(); }
  async login() { return this.tokens(this.loginUser); }
  async validate(): Promise<void> {}
  async refresh(tokens: ProviderTokens) { return tokens; }
  async signOut(): Promise<void> {}
  tokens(userId: string): ProviderTokens { return { userId, accessToken: "controlled-access", refreshToken: "controlled-refresh", expiresAt: Date.now() / 1000 + 3600 }; }
}

const customerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const detail: AdminCustomerDetail = {
  id: customerId, fullName: "Ada Customer", email: "ada@example.test", phone: "+2348012345678", joinedAt: "2026-09-01T00:00:00.000Z",
  accountType: "INVESTOR", profileType: "PERSONAL", hasPropertyActivity: true, hasListingActivity: true, hasReferralActivity: true,
  referralCode: "REF-ABC234", kycStatus: "APPROVED",
  propertyActivity: { hasActivity: true, firstActivityAt: "2026-09-02T00:00:00.000Z", savedProperties: 1, completedPurchases: 0 },
  listingActivity: { hasActivity: true, firstListingAt: "2026-09-03T00:00:00.000Z", listingCount: 1 },
  referralActivity: { hasActivity: true, firstReferralLinkAt: "2026-09-04T00:00:00.000Z", referralLinkCount: 1, referralCode: "REF-ABC234" },
  businessInformation: { exists: false, companyName: null, companyAddress: null },
};
const directory: AdminCustomerDirectoryPage = { summary: { totalUsers: 1, propertyActivityCustomers: 1, listingActivityCustomers: 1, referralActivityCustomers: 1 }, items: [detail], page: 1, pageSize: 6, total: 1, totalPages: 1 };

class CustomersRepository implements AdminCustomersRepository {
  queries: AdminCustomerDirectoryQuery[] = [];
  async directory(query: AdminCustomerDirectoryQuery) { this.queries.push(query); return directory; }
  async detail(id: string) { if (id !== customerId) throw new AuthError(404, "CUSTOMER_NOT_FOUND", "Customer not found."); return detail; }
}

const email: AdminInvitationEmail = { async send() { throw unavailable(); } };

async function fixture(t: TestContext) {
  const repository = new SessionRepository();
  const customers = new CustomersRepository();
  const identity = new Identity();
  const server = createApp({ webAppUrl: auth.webOrigin, auth, admin: adminConfig, adminRepository: repository, adminCustomersRepository: customers, adminIdentity: identity, adminEmail: email }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address();
  assert(address && typeof address !== "string");
  const jar = new Map<string, string>();
  async function request(path: string, body?: unknown) {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/admin${path}`, { method: body === undefined ? "GET" : "POST", headers: { Origin: adminConfig.appOrigin, "Content-Type": "application/json", Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; ") }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    for (const cookie of response.headers.getSetCookie()) { const [pair] = cookie.split(";"); const index = pair!.indexOf("="); const key = pair!.slice(0, index); const value = pair!.slice(index + 1); if (value) jar.set(key, value); else jar.delete(key); }
    return { response, body: await response.json() as { success: boolean; data?: Record<string, unknown>; error?: { code: string } } };
  }
  async function login(userId: string) { identity.loginUser = userId; return request("/auth/login", { email: "admin@example.test", password: "Controlled!9" }); }
  return { repository, customers, identity, request, login };
}

test("Admin customer endpoints reject unauthenticated, inactive, and non-Admin identities", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.request("/customers")).response.status, 401);
  assert.equal((await f.login(inactiveId)).response.status, 401);
  assert.equal((await f.login(nonAdminId)).response.status, 401);
  assert.equal(f.customers.queries.length, 0);
});

test("active ADMIN and SUPER_ADMIN may read customers while inactive sessions are revoked", async (t) => {
  for (const userId of [adminId, superId]) {
    const f = await fixture(t);
    assert.equal((await f.login(userId)).response.status, 200);
    const result = await f.request("/customers");
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body.data, directory);
  }
  const f = await fixture(t);
  await f.login(adminId);
  f.repository.profiles.get(adminId)!.active = false;
  assert.equal((await f.request("/customers")).response.status, 401);
});

test("directory validates and forwards server-backed search, classifications, sort and pagination", async (t) => {
  const f = await fixture(t);
  await f.login(superId);
  const result = await f.request("/customers?search=Ada%20Customer&accountType=PROPERTY_DEVELOPER&profileType=BUSINESS&sort=NAME_DESC&page=2&pageSize=6");
  assert.equal(result.response.status, 200);
  assert.deepEqual(f.customers.queries[0], { search: "Ada Customer", accountType: "PROPERTY_DEVELOPER", profileType: "BUSINESS", sort: "NAME_DESC", page: 2, pageSize: 6 });
  for (const path of ["/customers?accountType=BUYER", "/customers?profileType=TEAM", "/customers?page=0", "/customers?pageSize=101", `/customers?search=${"x".repeat(101)}`]) {
    assert.equal((await f.request(path)).response.status, 400);
  }
});

test("detail returns the requested read-only projection and handles missing customers", async (t) => {
  const f = await fixture(t);
  await f.login(adminId);
  const found = await f.request(`/customers/${customerId}`);
  assert.equal(found.response.status, 200);
  assert.deepEqual(found.body.data?.customer, detail);
  assert.equal(JSON.stringify(found.body).includes("password"), false);
  assert.equal((await f.request("/customers/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")).response.status, 404);
  assert.equal((await f.request("/customers/not-a-uuid")).response.status, 400);
});

test("customer directory migration derives classifications and truthful activity without duplicate joins", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec("create schema auth; create function auth.uid() returns uuid language sql stable as 'select null::uuid'; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}'); create role anon; create role authenticated; create role service_role bypassrls;");
  const migrations = [
    "202609060001_customer_auth_foundation.sql",
    "202609080001_customer_listings.sql",
    "202609100001_short_display_codes.sql",
    "202609130001_customer_referrals.sql",
    "202609140001_customer_settings_profile.sql",
    "202609140002_customer_settings_business.sql",
    "202609140003_customer_kyc.sql",
    "202609250002_customer_saved_properties.sql",
    "202609270002_customer_completed_purchases.sql",
    "202609270005_admin_customer_directory.sql",
  ];
  for (const migration of migrations) await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"));

  const multiId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const businessId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const inactiveCustomerId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const metadata = (first_name: string, last_name: string, phone: string, profile_type: "PERSONAL" | "BUSINESS", account_type = "INVESTOR") => ({ first_name, last_name, country_code: "+234", phone_number: phone.slice(4), phone_number_normalized: phone, account_type, profile_type });
  for (const [id, address, values] of [
    [multiId, "ada@example.test", metadata("Ada", "Multi", "+2348011111111", "PERSONAL")],
    [businessId, "bisi@example.test", metadata("Bisi", "Business", "+2348022222222", "BUSINESS", "PROPERTY_DEVELOPER")],
    [inactiveCustomerId, "chidi@example.test", metadata("Chidi", "Empty", "+2348033333333", "PERSONAL")],
  ] as const) await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)", [id, address, values]);
  await db.query("update customer_profiles set created_at=case id when $1 then '2026-01-01'::timestamptz when $2 then '2026-01-02'::timestamptz else '2026-01-03'::timestamptz end", [multiId, businessId]);

  const listingSql = "insert into customer_listings(id,user_id,listing_code,title,description,occupancy_type,ownership_type,property_type,property_subtype,has_lien,bedrooms,bathrooms,parking_spaces,facilities,property_cost_minor,minimum_down_payment_minor,location,state,city,listing_status) values($1,$2,$3,$4,'Controlled listing','Residential','Personal','Residential','Bungalow',false,3,2,1,'{}',50000000,5000000,'Controlled address','Lagos','Ikeja','LISTED')";
  const listingA1 = "10000000-0000-4000-8000-000000000001";
  const listingA2 = "10000000-0000-4000-8000-000000000002";
  const listingB = "10000000-0000-4000-8000-000000000003";
  await db.query(listingSql, [listingA1, multiId, "RES-AAAAAA", "Ada Listing One"]);
  await db.query(listingSql, [listingA2, multiId, "RES-AAAABB", "Ada Listing Two"]);
  await db.query(listingSql, [listingB, businessId, "RES-BBBBBB", "Business Listing"]);
  await db.query("insert into customer_saved_properties(user_id,listing_id,created_at) values($1,$2,'2026-02-01')", [multiId, listingB]);
  await db.query("insert into customer_completed_purchases(id,customer_id,source_listing_id,property_code,title,state,property_type,property_subtype,price_minor,closed_at) values('20000000-0000-4000-8000-000000000001',$1,$2,'RES-BBBBBB','Business Purchase','Lagos','Residential','Bungalow',50000000,'2026-02-02')", [businessId, listingB]);
  await db.query("insert into customer_referral_links(user_id,referral_code,referral_type,created_at) values($1,'REF-AAAAAA','SELLER','2026-03-01')", [multiId]);
  await db.query("insert into customer_referral_links(user_id,referral_code,referral_type,listing_id,property_code,created_at) values($1,'REF-AAAABB','PROPERTY',$2,'RES-AAAAAA','2026-03-02')", [multiId, listingA1]);
  await db.query("insert into customer_business_profiles(user_id,company_code,company_name,street_address,city,state,country) values($1,'BUS-BBBBBB','Bisi Developments Ltd.','7 Adeola Odeku Street','Victoria Island','Lagos','Nigeria')", [businessId]);
  await db.query("insert into customer_kyc_submissions(user_id,country,document_type,status,declaration_accepted_at,submitted_at,reviewed_at) values($1,'Nigeria','PASSPORT','APPROVED',now(),'2026-04-01','2026-04-02')", [businessId]);
  await db.query("insert into customer_kyc_submissions(user_id,country,document_type,status,declaration_accepted_at,submitted_at) values($1,'Nigeria','NATIONAL_ID','PENDING_REVIEW',now(),'2026-04-03')", [inactiveCustomerId]);

  async function directoryResult(search = "", accountType = "ALL", profileType = "ALL", sort = "NEWEST", page = 1, pageSize = 6) {
    const result = await db.query<{ value: AdminCustomerDirectoryPage }>("select public.list_admin_customers($1,$2,$3,$4,$5,$6) value", [search, accountType, profileType, sort, page, pageSize]);
    return result.rows[0]!.value;
  }
  async function detailResult(id: string) {
    const result = await db.query<{ value: AdminCustomerDetail }>("select public.read_admin_customer($1) value", [id]);
    return result.rows[0]!.value;
  }

  await db.exec("set role anon");
  await assert.rejects(db.query("select public.list_admin_customers('', 'ALL', 'ALL', 'NEWEST', 1, 6)"));
  await db.exec("reset role");

  const all = await directoryResult();
  assert.deepEqual(all.summary, { totalUsers: 3, propertyActivityCustomers: 2, listingActivityCustomers: 2, referralActivityCustomers: 1 });
  assert.equal(all.items.length, 3);
  assert.equal(all.items.filter((item) => item.id === multiId).length, 1);
  assert.equal(all.items.find((item) => item.id === multiId)?.accountType, "INVESTOR");
  assert.equal(all.items.find((item) => item.id === multiId)?.profileType, "PERSONAL");
  assert.equal(all.items.find((item) => item.id === multiId)?.hasPropertyActivity, true);
  assert.equal(all.items.find((item) => item.id === multiId)?.hasListingActivity, true);
  assert.equal(all.items.find((item) => item.id === multiId)?.hasReferralActivity, true);
  assert.equal(all.items.find((item) => item.id === businessId)?.hasPropertyActivity, true);
  assert.equal(all.items.find((item) => item.id === businessId)?.kycStatus, "APPROVED");
  assert.equal(all.items.find((item) => item.id === inactiveCustomerId)?.kycStatus, "PENDING_REVIEW");
  assert.equal((await directoryResult("802222")).items[0]?.id, businessId);
  assert.equal((await directoryResult("ada@example")).items[0]?.id, multiId);
  assert.deepEqual((await directoryResult("", "PROPERTY_DEVELOPER")).items.map((item) => item.id), [businessId]);
  assert.deepEqual((await directoryResult("", "ALL", "BUSINESS")).items.map((item) => item.id), [businessId]);
  assert.deepEqual((await directoryResult("", "ALL", "ALL", "NAME_ASC")).items.map((item) => item.id), [multiId, businessId, inactiveCustomerId]);
  assert.deepEqual((await directoryResult("", "ALL", "ALL", "OLDEST", 2, 1)).items.map((item) => item.id), [businessId]);
  assert.equal((await directoryResult("", "ALL", "ALL", "OLDEST", 2, 1)).totalPages, 3);

  const multi = await detailResult(multiId);
  assert.equal(multi.propertyActivity.hasActivity, true);
  assert.equal(multi.propertyActivity.savedProperties, 1);
  assert.equal(multi.propertyActivity.completedPurchases, 0);
  assert.equal(multi.listingActivity.listingCount, 2);
  assert.equal(multi.referralActivity.referralLinkCount, 2);
  assert.equal(multi.referralActivity.referralCode, "REF-AAAAAA");
  const business = await detailResult(businessId);
  assert.equal(business.accountType, "PROPERTY_DEVELOPER");
  assert.equal(business.profileType, "BUSINESS");
  assert.equal(business.propertyActivity.completedPurchases, 1);
  assert.equal(business.businessInformation.exists, true);
  assert.equal(business.businessInformation.companyName, "Bisi Developments Ltd.");
  assert.match(business.businessInformation.companyAddress ?? "", /Victoria Island, Lagos, Nigeria/);
  assert.equal(business.kycStatus, "APPROVED");
  const inactive = await detailResult(inactiveCustomerId);
  assert.equal(inactive.propertyActivity.hasActivity, false);
  assert.equal(inactive.listingActivity.hasActivity, false);
  assert.equal(inactive.referralActivity.hasActivity, false);
  const serialized = JSON.stringify(business);
  for (const privateField of ["bank_account", "public_id", "document", "password", "token"]) assert.equal(serialized.includes(privateField), false);
  await assert.rejects(detailResult("dddddddd-dddd-4ddd-8ddd-dddddddddddd"), /Customer not found/);
});
