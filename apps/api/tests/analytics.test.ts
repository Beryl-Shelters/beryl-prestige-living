import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { randomBytes } from "node:crypto";
import { createApp } from "../src/app.js";
import { authConfigSchema } from "../src/auth/config.js";
import { AuthCipher, hashToken } from "../src/auth/crypto.js";
import { expired } from "../src/auth/errors.js";
import type { AuthGateway, Customer, StoredSession } from "../src/auth/gateway.js";
import { bedroomBuckets, months, type AnalyticsCounts, type CustomerAnalytics } from "../src/dashboard/analytics-model.js";
import { EmptyCategoryPerformanceRepository, SupabaseAnalyticsRepository, type AnalyticsRepository, type CategoryPerformanceRepository } from "../src/dashboard/analytics-repository.js";
import { AnalyticsService } from "../src/dashboard/analytics-service.js";

const config = authConfigSchema.parse({ webOrigin: "http://localhost:3000", apiOrigin: "http://localhost:4000",
  supabaseUrl: "https://example.supabase.co", anonKey: "test-anon", serviceKey: "test-service",
  encryptionKey: randomBytes(32).toString("base64"), cookieSecure: false, production: false });
const owner = "11111111-1111-4111-8111-111111111111";
const rows = [
  ...["UNLISTED", "LISTED", "PENDING", "REJECTED", "LISTED", "PENDING", "UNLISTED", "PENDING"].map((status, index) => ({
    owner, status, title: index === 1 ? "Beta Villa" : `Alpha Home ${index}`, code: `RES-TEST0${index}`,
    bedrooms: index === 6 ? 0 : index === 7 ? 7 : index + 1,
    property_type: [2, 4, 7].includes(index) ? "Commercial" : "Residential",
    property_subtype: index % 2 ? "Bungalow" : "Semi-Detached House",
  })),
  { owner: "foreign", status: "LISTED", title: "Private Alpha", code: "RES-SECRET", bedrooms: 1, property_type: "Commercial", property_subtype: "Bungalow" },
];
function counts(customerId: string, search: string): AnalyticsCounts {
  const matches = rows.filter(row => row.owner === customerId && [row.title, row.code].some(value => value.toLowerCase().includes(search.toLowerCase())));
  return {
    total: matches.length,
    listed: matches.filter(row => row.status === "LISTED").length,
    pending: matches.filter(row => row.status === "PENDING").length,
    rejected: matches.filter(row => row.status === "REJECTED").length,
    bedrooms: Object.fromEntries(bedroomBuckets.map(bedroom => [bedroom, matches.filter(row => row.bedrooms === bedroom).length])) as AnalyticsCounts["bedrooms"],
    commercial: matches.filter(row => row.property_type === "Commercial").length,
    residential: matches.filter(row => row.property_type === "Residential").length,
  };
}
async function fixture(t: TestContext, performance?: CategoryPerformanceRepository) {
  const raw = "opaque-analytics-session";
  const profile: Customer = { id: owner, first_name: "Ada", last_name: "Okafor", email: "ada@example.test", country_code: null,
    phone_number: null, phone_number_normalized: null, account_type: "INVESTOR", profile_type: "PERSONAL", email_verified_at: new Date().toISOString() };
  const row: StoredSession = { token_hash: hashToken(raw), user_id: owner, purpose: "ACCOUNT", refresh_lock: null,
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    encrypted_tokens: new AuthCipher(config.encryptionKey).seal({ userId: owner, accessToken: "private-access", refreshToken: "private-refresh", expiresAt: Date.now() / 1000 + 3600 }, "provider-tokens") };
  const state = { invalidProvider: false, failed: false };
  const calls: { customerId: string; search: string }[] = [];
  const repository: AnalyticsRepository = { async counts(customerId, search) {
    calls.push({ customerId, search }); if (state.failed) throw new Error("private database diagnostics");
    return counts(customerId, search);
  } };
  const gateway = {
    async readSession(hash: string, purpose: string) { return hash === row.token_hash && purpose === row.purpose && Date.parse(row.expires_at) > Date.now() ? row : null; },
    async validate() { if (state.invalidProvider) throw expired(); },
    async findCustomer(column: string, id: string) { assert.equal(column, "id"); assert.equal(id, owner); return profile; },
  } as unknown as AuthGateway;
  const server = createApp({ webAppUrl: config.webOrigin, auth: config, gateway, analyticsRepository: repository, ...(performance ? { categoryPerformanceRepository: performance } : {}) }).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address(); assert(address && typeof address !== "string");
  async function request(suffix = "", cookie = `beryl_account=${raw}`, headers = {}) {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/dashboard/analytics${suffix}`, { headers: { Cookie: cookie, ...headers } });
    const payload = await response.json();
    return { response, payload, data: payload.data as CustomerAnalytics };
  }
  return { request, row, profile, state, calls, raw };
}

test("analytics rejects anonymous, forged, recovery-only and expired sessions before querying listings", async t => {
  const { request, row, raw, calls } = await fixture(t);
  for (const cookie of ["", "beryl_account=forged", `beryl_recovery=${raw}`]) assert.equal((await request("", cookie)).response.status, 401);
  row.expires_at = new Date(0).toISOString(); assert.equal((await request()).response.status, 401);
  assert.deepEqual(calls, []);
});
test("analytics rejects provider-invalid and unverified accounts", async t => {
  const { request, state, profile, calls } = await fixture(t);
  state.invalidProvider = true; assert.equal((await request()).response.status, 401);
  state.invalidProvider = false; profile.email_verified_at = null;
  assert.equal((await request()).response.status, 401); assert.deepEqual(calls, []);
});
test("analytics total includes UNLISTED, excludes foreign listings, and computes status percentages", async t => {
  const { request, calls } = await fixture(t); const { response, data } = await request();
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store"); assert.match(response.headers.get("vary") ?? "", /Cookie/);
  assert.deepEqual(data.listingsOverview, { total: 8, listed: { count: 2, percentage: 25 }, pending: { count: 3, percentage: 37.5 }, rejected: { count: 1, percentage: 12.5 } });
  assert.deepEqual(calls, [{ customerId: owner, search: "" }]);
  assert(!("unlisted" in data.listingsOverview));
});
test("analytics zero matches produce finite zero percentages and counts", async t => {
  const { request } = await fixture(t); const { data } = await request("?q=no-such-listing");
  assert.equal(data.listingsOverview.total, 0);
  for (const status of ["listed", "pending", "rejected"] as const) assert.deepEqual(data.listingsOverview[status], { count: 0, percentage: 0 });
  assert(Object.values(data.bedrooms).every(value => value === 0)); assert(Object.values(data.propertyTypes).every(value => value === 0));
});
test("analytics trims title search and matches case-insensitively across listing-derived sections", async t => {
  const { request, calls } = await fixture(t); const { data } = await request("?q=%20%20bEtA%20%20");
  assert.equal(data.listingsOverview.total, 1); assert.equal(data.listingsOverview.listed.percentage, 100);
  assert.equal(data.bedrooms[2], 1); assert.equal(data.propertyTypes.residential, 1); assert.equal(data.propertyTypes.commercial, 0);
  assert.equal(calls[0]?.search, "bEtA");
});
test("analytics searches display code and blank search restores all owned listings", async t => {
  const { request } = await fixture(t);
  assert.equal((await request("?q=res-test02")).data.listingsOverview.total, 1);
  assert.equal((await request("?q=res-test02")).data.propertyTypes.commercial, 1);
  assert.equal((await request("?q=%20%20")).data.listingsOverview.total, 8);
});
test("analytics cannot discover a foreign customer's title or display code", async t => {
  const { request } = await fixture(t);
  for (const q of ["Private", "RES-SECRET"]) assert.equal((await request(`?q=${q}`)).data.listingsOverview.total, 0);
});
test("analytics returns exactly bedroom buckets 1 through 6, excluding zero and 7+", async t => {
  const { request } = await fixture(t); const { data } = await request();
  assert.deepEqual(data.bedrooms, { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 });
});
test("analytics counts Residential/Commercial without inventing legacy subtype mappings", async t => {
  const { request } = await fixture(t);
  assert.deepEqual((await request()).data.propertyTypes, { commercial: 3, residential: 5, detachedHouses: 0, flats: 0, others: 0 });
});
test("analytics always returns twelve ordered legitimate zero monthly buckets, regardless of year or listings", async t => {
  const { request } = await fixture(t);
  for (const year of [2000, 2026, 2100]) {
    const { data } = await request(`?year=${year}`); assert.equal(data.year, year);
    assert.deepEqual(data.categoryPerformance, months.map((label, index) => ({ month: index + 1, label, buy: 0, sell: 0, referral: 0 })));
  }
  assert.equal((await request()).data.year, new Date().getUTCFullYear());
});
test("analytics rejects malformed years, duplicate filters, long searches and customer selectors", async t => {
  const { request, calls } = await fixture(t);
  for (const query of ["year=1999", "year=2101", "year=2026.5", "year=2e3", "year=", "year=abcd", "year=02026", "year[]=2026", "year=2025&year=2026", "q=a&q=b", `q=${"a".repeat(101)}`, "user_id=foreign", "customerId=foreign", "id=foreign", "owner=foreign", "user_id[]=foreign"]) {
    assert.equal((await request(`?${query}`)).response.status, 400, query);
  }
  assert.deepEqual(calls, []);
});
test("analytics ignores spoofed identity headers and derives its owner exclusively from the account session", async t => {
  const { request, calls } = await fixture(t);
  const { data } = await request("", undefined, { "X-User-Id": "foreign", "X-Customer-Id": "foreign", "X-Owner-Id": "foreign" });
  assert.equal(data.listingsOverview.total, 8); assert(calls.every(call => call.customerId === owner));
});
test("analytics database and future performance failures return safe errors, never successful zeros", async t => {
  const f = await fixture(t); f.state.failed = true;
  const { response, payload } = await f.request(); assert.equal(response.status, 503); assert.equal(payload.error.code, "ANALYTICS_UNAVAILABLE");
  assert.equal(payload.data, undefined); assert(!JSON.stringify(payload).includes("private database"));
  const g = await fixture(t, { async monthly() { throw new Error("private adapter failure"); } });
  assert.equal((await g.request()).response.status, 503);
});
test("analytics supports real future performance adapters without changing the response contract", async () => {
  const calls: unknown[] = [];
  const service = new AnalyticsService({ async counts(id, q) { calls.push([id, q]); return counts(id, q); } }, {
    async monthly(id, year) { calls.push([id, year]); return { buy: months.map(() => 1), sell: months.map(() => 2), referral: months.map(() => 3) }; },
  });
  const result = await service.analytics(owner, "Beta", 2024);
  assert.deepEqual(calls, [[owner, "Beta"], [owner, 2024]]);
  assert.deepEqual(result.categoryPerformance[0], { month: 1, label: "Jan", buy: 1, sell: 2, referral: 3 });
  const empty = new EmptyCategoryPerformanceRepository(); assert.deepEqual(await empty.monthly(), { buy: Array(12).fill(0), sell: Array(12).fill(0), referral: Array(12).fill(0) });
});
test("analytics percentages round deterministically and stay bounded during concurrent count changes", async () => {
  const snapshot = counts(owner, ""); snapshot.total = 3; snapshot.listed = 1; snapshot.pending = 4;
  const result = await new AnalyticsService({ async counts() { return snapshot; } }).analytics(owner, "", 2026);
  assert.equal(result.listingsOverview.listed.percentage, 33.33); assert.equal(result.listingsOverview.pending.percentage, 100);
});
test("production analytics uses twelve exact owner-scoped HEAD counts, not a truncated page or media rows", async () => {
  const calls: URL[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    assert.equal(init?.method, "HEAD"); const url = new URL(String(input)); calls.push(url);
    assert.equal(url.pathname, "/rest/v1/customer_listings"); assert.equal(url.searchParams.get("user_id"), `eq.${owner}`);
    assert.equal(url.searchParams.get("select"), "id"); assert.equal(url.searchParams.has("limit"), false);
    assert.match(new Headers(init?.headers).get("prefer") ?? "", /count=exact/);
    return new Response(null, { status: 200, headers: { "content-range": "*/2501" } });
  };
  const result = await new SupabaseAnalyticsRepository(config, fetcher).counts(owner, "Alpha");
  assert.equal(result.total, 2501); assert.equal(calls.length, 12);
  assert(calls.every(url => url.searchParams.get("or") === '(title.ilike."%Alpha%",listing_code.ilike."%Alpha%")'));
  assert.deepEqual(calls.map(url => url.searchParams.get("bedrooms")).filter(Boolean).sort(), bedroomBuckets.map(value => `eq.${value}`));
  assert.deepEqual(calls.map(url => url.searchParams.get("property_type")).filter(Boolean).sort(), ["eq.Commercial", "eq.Residential"]);
});
test("production analytics quotes filter grammar and escapes search wildcards without removing owner scope", async () => {
  const malicious = 'x%_*\\",user_id.eq.foreign';
  const escaped = malicious.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[%_*]/g, value => `\\${value}`);
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input)); assert.equal(url.searchParams.get("user_id"), `eq.${owner}`);
    assert.equal(url.searchParams.get("or"), `(title.ilike."%${escaped}%",listing_code.ilike."%${escaped}%")`);
    return new Response(null, { headers: { "content-range": "*/0" } });
  };
  assert.equal((await new SupabaseAnalyticsRepository(config, fetcher).counts(owner, malicious)).total, 0);
});
test("production analytics refuses failed or missing exact count responses", async () => {
  for (const status of [200, 503]) {
    await assert.rejects(new SupabaseAnalyticsRepository(config, async () => new Response(null, { status })).counts(owner, ""));
  }
});
