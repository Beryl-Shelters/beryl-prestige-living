import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { authConfigSchema } from "../src/auth/config.js";
import { listingOptions } from "../src/listings/model.js";
import { publicPropertyQuery, type PublicPropertyPage, type PublicPropertyQuery } from "../src/public-properties/model.js";
import { SupabasePublicPropertiesRepository, type PublicPropertiesRepository } from "../src/public-properties/repository.js";

const config = authConfigSchema.parse({ webOrigin: "http://localhost:3000", apiOrigin: "http://localhost:4000",
  supabaseUrl: "https://example.supabase.co", anonKey: "test", serviceKey: "test",
  encryptionKey: randomBytes(32).toString("base64"), cookieSecure: false, production: false });

test("public filter taxonomy mirrors authoritative listing options", () => {
  for (const propertySubtype of listingOptions.property_subtype) assert.equal(publicPropertyQuery.parse({ propertySubtype }).propertySubtype, propertySubtype);
  for (const facility of listingOptions.facilities) assert.equal(publicPropertyQuery.parse({ facility }).facility, facility);
  for (const state of listingOptions.state) assert.equal(publicPropertyQuery.parse({ state }).state, state);
  for (const sort of ["latest", "oldest", "price_asc", "price_desc"]) assert.equal(publicPropertyQuery.parse({ sort }).sort, sort);
});

test("public properties are read-only, unauthenticated, validated and never record search events", async t => {
  const queries: PublicPropertyQuery[] = [];
  let fail = false, searchEvents = 0;
  const empty: PublicPropertyPage = { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 };
  const repository: PublicPropertiesRepository = { async list(query) { queries.push(query); if (fail) throw new Error("private SQL details");
    return { ...empty, page: query.page, pageSize: query.pageSize }; } };
  const server = createApp({ webAppUrl: config.webOrigin, auth: config, publicPropertiesRepository: repository,
    publicAnalyticsRepository: { async read() { throw new Error("unused"); }, async recordSearch() { searchEvents++; } } }).listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address(); assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/v1/public/properties`;
  const response = await fetch(base); assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { success: true, data: empty });
  assert.deepEqual(queries[0], publicPropertyQuery.parse({}));
  const filtered = await fetch(base + "?q=  RES-ABC  &propertyType=Residential&propertySubtype=Bungalow&state=Lagos&city=Ikeja&minPrice=0&maxPrice=999999999999999&bedrooms=0&bathrooms=2&facility=Wi-Fi&page=2&pageSize=50");
  assert.equal(filtered.status, 200);
  assert.deepEqual(queries.at(-1), { q: "RES-ABC", propertyType: "Residential", propertySubtype: "Bungalow", state: "Lagos", city: "Ikeja",
    minPrice: 0, maxPrice: 999999999999999, bedrooms: 0, bathrooms: 2, facility: "Wi-Fi", sort: "latest", page: 2, pageSize: 50 });
  for (const query of ["q=" + "x".repeat(101), "page=0", "page=100001", "page=1.5", "page=1e2", "pageSize=51", "pageSize=0",
    "minPrice=-1", "minPrice=1.25", "maxPrice=9999999999999999", "minPrice=3&maxPrice=2", "bedrooms=1.5", "bathrooms=-1",
    "propertyType=Land", "propertySubtype=Villa", "facility=Pool", "state=Atlantis", "state=", "city=", "sort=price", "bedroomsMin=8", "bedrooms=2&bedroomsMin=7", "owner=secret", "q=a&q=b", "page[]=1"]) {
    assert.equal((await fetch(base + "?" + query)).status, 400, query);
  }
  assert.equal(queries.length, 2);
  const expanded = await fetch(base + "?state=Abia&propertySubtype=Detached%20Duplexes&facility=Tennis%20Court&bedroomsMin=7&bathroomsMin=7&sort=price_desc");
  assert.equal(expanded.status, 200);
  assert.deepEqual(queries.at(-1), publicPropertyQuery.parse({ state: "Abia", propertySubtype: "Detached Duplexes", facility: "Tennis Court", bedroomsMin: "7", bathroomsMin: "7", sort: "price_desc" }));
  assert.equal((await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 404);
  assert.equal(searchEvents, 0);
  fail = true;
  const unavailable = await fetch(base); assert.equal(unavailable.status, 503);
  assert(!JSON.stringify(await unavailable.json()).includes("private SQL"));
});

test("repository projects only LISTED public fields, includes legacy null dates and orders/paginates deterministically", async t => {
  const originalFetch = globalThis.fetch;
  const requests: URL[] = [];
  let fail = false;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input)); requests.push(url);
    if (fail) return new Response(JSON.stringify({ message: "private provider detail" }), { status: 500, headers: { "Content-Type": "application/json" } });
    return new Response(JSON.stringify([{ listing_code: "RES-ABC234", title: "Home", description: "Public description",
      property_type: "Residential", property_subtype: "Bungalow", property_cost_minor: 999999999999999,
      state: "Lagos", city: "Ikeja", bedrooms: 2, bathrooms: 1, parking_spaces: 1,
      facilities: ["Wi-Fi"], listed_at: null, images: [{ url: "https://res.cloudinary.com/example/image/second", sort_order: 1 },
        { url: "https://res.cloudinary.com/example/image/first", sort_order: 0 }],
      user_id: "never-serialize", email: "never-serialize", documents: [{ public_id: "private" }], public_id: "private" }]),
      { status: 200, headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const repository = new SupabasePublicPropertiesRepository(config);
  const page = await repository.list(publicPropertyQuery.parse({ q: "100%_*,\"\\", propertyType: "Residential", propertySubtype: "Bungalow",
    state: "Lagos", city: "Ikeja", minPrice: "0", maxPrice: "999999999999999", bedrooms: "2", bathrooms: "1",
    facility: "Wi-Fi", page: "1", pageSize: "10" }));
  assert.deepEqual(page, { page: 1, pageSize: 10, total: 1, totalPages: 1, items: [{ code: "RES-ABC234", title: "Home",
    description: "Public description", propertyType: "Residential", propertySubtype: "Bungalow", priceMinor: 999999999999999,
    state: "Lagos", city: "Ikeja", bedrooms: 2, bathrooms: 1, parkingSpaces: 1, facilities: ["Wi-Fi"], listedAt: null,
    images: ["https://res.cloudinary.com/example/image/first", "https://res.cloudinary.com/example/image/second"] }] });
  const url = requests[0]!;
  assert.equal(url.pathname, "/rest/v1/customer_listings");
  assert.equal(url.searchParams.get("listing_status"), "eq.LISTED");
  assert.equal(url.searchParams.get("property_type"), "eq.Residential");
  assert.equal(url.searchParams.get("property_subtype"), "eq.Bungalow");
  assert.equal(url.searchParams.get("state"), "eq.Lagos");
  assert.equal(url.searchParams.get("city"), "eq.Ikeja");
  assert.deepEqual(url.searchParams.getAll("property_cost_minor"), ["gte.0", "lte.999999999999999"]);
  assert.equal(url.searchParams.get("bedrooms"), "eq.2");
  assert.equal(url.searchParams.get("bathrooms"), "eq.1");
  assert(url.searchParams.get("facilities")?.includes("Wi-Fi"));
  assert(url.searchParams.get("or")?.includes("100\\%\\_\\*"));
  assert.equal(url.searchParams.get("order"), "listed_at.desc.nullslast,created_at.desc,id.desc");
  for (const [sort, order] of [["latest","listed_at.desc.nullslast,created_at.desc,id.desc"],["oldest","listed_at.asc.nullslast,created_at.asc,id.asc"],["price_asc","property_cost_minor.asc,listed_at.desc.nullslast,created_at.desc,id.desc"],["price_desc","property_cost_minor.desc,listed_at.desc.nullslast,created_at.desc,id.desc"]] as const) {
    await repository.list(publicPropertyQuery.parse({ sort, page: "2", pageSize: "10", bedroomsMin: "7", bathroomsMin: "7", state: "Rivers", facility: "Basketball Court" }));
    const sorted = requests.at(-1)!;
    assert.equal(sorted.searchParams.get("order"), order);
    assert.equal(sorted.searchParams.get("bedrooms"), "gte.7");
    assert.equal(sorted.searchParams.get("bathrooms"), "gte.7");
    assert.equal(sorted.searchParams.get("state"), "eq.Rivers");
    assert(sorted.searchParams.get("facilities")?.includes("Basketball Court"));
    assert.equal(sorted.searchParams.get("offset"), "10");
  }
  const projection = url.searchParams.get("select")!;
  for (const privateField of ["user_id", "email", "phone", "documents", "public_id", "requested_at", "version", "minimum_down_payment_minor"])
    assert(!projection.includes(privateField), privateField);
  fail = true;
  await assert.rejects(() => repository.list(publicPropertyQuery.parse({})), /Public properties unavailable/);
});
