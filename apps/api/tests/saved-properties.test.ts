import assert from "node:assert/strict";
import { test } from "node:test";
import { savedPropertiesFixture } from "./saved-properties.fixture.js";

test("saved properties require a current verified account session", async t => {
  const f = await savedPropertiesFixture(t);
  for (const cookie of ["", "beryl_account=forged"]) assert.equal((await f.request("", "GET", undefined, cookie)).response.status, 401);
});

test("a customer saves any LISTED property idempotently without business side effects", async t => {
  const f = await savedPropertiesFixture(t);
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await f.request("", "POST", { propertyCode: "RES-OTH222" });
    assert.equal(result.response.status, 201); assert.deepEqual(result.payload.data, { propertyCode: "RES-OTH222", saved: true });
  }
  assert.equal((await f.db.query<{ count: number }>("select count(*)::integer count from public.customer_saved_properties")).rows[0]!.count, 1);
  assert.equal((await f.db.query<{ count: number }>("select count(*)::integer count from public.customer_referral_links")).rows[0]!.count, 0);
  const listing = (await f.db.query<{ status: string; owner: string }>("select listing_status status,user_id owner from public.customer_listings where id=$1", [f.foreignListing])).rows[0]!;
  assert.deepEqual(listing, { status: "LISTED", owner: f.other });
});

test("non-LISTED and nonexistent properties cannot be saved", async t => {
  const f = await savedPropertiesFixture(t);
  for (const code of ["RES-HID333", "RES-NOPE99"]) assert.equal((await f.request("", "POST", { propertyCode: code })).response.status, 404);
  for (const status of ["UNLISTED", "PENDING", "REJECTED"]) {
    await f.db.query("update public.customer_listings set listing_status=$1 where id=$2", [status, f.foreignListing]);
    assert.equal((await f.request("", "POST", { propertyCode: "RES-OTH222" })).response.status, 404);
  }
});

test("list and search are owner-scoped, paginated and return only the safe public DTO", async t => {
  const f = await savedPropertiesFixture(t);
  await f.repository.save(f.owner, "RES-OTH222"); await f.repository.save(f.other, "RES-OWN111");
  const listed = await f.request("?q=Port%20Harcourt&page=1&pageSize=12");
  assert.equal(listed.response.status, 200); assert.equal(listed.response.headers.get("cache-control"), "no-store");
  assert.deepEqual(listed.payload.data, { page: 1, pageSize: 12, total: 1, totalPages: 1, items: [{
    code: "RES-OTH222", title: "Foreign listed home", description: "Safe public description", propertyType: "Residential", propertySubtype: "Bungalow",
    priceMinor: 8500000000, state: "Rivers", city: "Port Harcourt", bedrooms: 4, bathrooms: 2, parkingSpaces: 1, facilities: ["Wi-Fi"],
    listedAt: listed.payload.data.items[0].listedAt, images: ["https://images.example.test/saved-home.png"],
  }] });
  const serialized = JSON.stringify(listed.payload);
  for (const secret of [f.owner, f.other, f.foreignListing, "user_id", "public_id", "minimum_down_payment_minor", "documents"]) assert(!serialized.includes(secret), secret);
  assert.equal((await f.request("?q=Owner%20home")).payload.data.total, 0, "another customer's save must not appear");
});

test("a non-LISTED saved relationship stays dormant without leaking and may reappear after relisting", async t => {
  const f = await savedPropertiesFixture(t); await f.repository.save(f.owner, "RES-OTH222");
  await f.db.query("update public.customer_listings set listing_status='UNLISTED' where id=$1", [f.foreignListing]);
  const hidden = await f.request(); assert.deepEqual(hidden.payload.data.items, []); assert.equal(hidden.payload.data.total, 0);
  assert.equal((await f.db.query<{ count: number }>("select count(*)::integer count from public.customer_saved_properties")).rows[0]!.count, 1);
  await f.db.query("update public.customer_listings set listing_status='LISTED',listed_at=clock_timestamp() where id=$1", [f.foreignListing]);
  assert.equal((await f.request()).payload.data.items[0].code, "RES-OTH222");
});

test("unsave removes only the caller relationship and never the listing or another customer's save", async t => {
  const f = await savedPropertiesFixture(t); await f.repository.save(f.owner, "RES-OTH222"); await f.repository.save(f.other, "RES-OTH222");
  const removed = await f.request("/RES-OTH222", "DELETE", {}); assert.equal(removed.response.status, 200); assert.deepEqual(removed.payload.data, { propertyCode: "RES-OTH222", saved: false });
  assert.equal((await f.db.query<{ count: number }>("select count(*)::integer count from public.customer_saved_properties where user_id=$1", [f.owner])).rows[0]!.count, 0);
  assert.equal((await f.db.query<{ count: number }>("select count(*)::integer count from public.customer_saved_properties where user_id=$1", [f.other])).rows[0]!.count, 1);
  assert.equal((await f.db.query<{ count: number }>("select count(*)::integer count from public.customer_listings where id=$1", [f.foreignListing])).rows[0]!.count, 1);
  assert.equal((await f.request("/RES-OTH222", "DELETE", {})).response.status, 200, "repeat unsave is idempotent");
});

test("saved-state lookup is owner-scoped and excludes dormant relationships", async t => {
  const f = await savedPropertiesFixture(t); await f.repository.save(f.owner, "RES-OTH222"); await f.repository.save(f.other, "RES-OWN111");
  assert.deepEqual((await f.request("/states?codes=RES-OTH222,RES-OWN111")).payload.data.propertyCodes, ["RES-OTH222"]);
  await f.db.query("update public.customer_listings set listing_status='PENDING' where id=$1", [f.foreignListing]);
  assert.deepEqual((await f.request("/states?codes=RES-OTH222")).payload.data.propertyCodes, []);
});

test("saved-property inputs, origins and direct table/RPC access are restricted", async t => {
  const f = await savedPropertiesFixture(t);
  for (const path of ["?page=0", "?page=1.5", "?pageSize=25", "?q=" + "x".repeat(101), "?userId=other", "?q=a&q=b"])
    assert.equal((await f.request(path)).response.status, 400, path);
  assert.equal((await f.request("", "POST", { propertyCode: "RES-OTH222", userId: f.other })).response.status, 400);
  assert.equal((await f.request("", "POST", { propertyCode: "RES-OTH222" }, undefined, { Origin: "https://evil.example" })).response.status, 403);
  await assert.rejects(f.db.query("set role authenticated; select * from public.customer_saved_properties")); await f.db.exec("reset role");
  await assert.rejects(f.db.query("set role authenticated; select public.save_customer_property($1,$2)", [f.owner, "RES-OTH222"])); await f.db.exec("reset role");
});

test("foreign-key cascades clean up only bookmark relationships", async t => {
  const f = await savedPropertiesFixture(t); await f.repository.save(f.owner, "RES-OTH222");
  await f.db.query("delete from public.customer_listings where id=$1", [f.foreignListing]);
  assert.equal((await f.db.query<{ count: number }>("select count(*)::integer count from public.customer_saved_properties")).rows[0]!.count, 0);
});

test("comparison requires authentication and two to three unique public codes", async t => {
  const f = await savedPropertiesFixture(t);
  assert.equal((await f.request("/compare?codes=RES-OTH222,RES-THR444", "GET", undefined, "")).response.status, 401);
  for (const codes of ["RES-OTH222", "RES-OTH222,RES-OTH222", "RES-OWN111,RES-OTH222,RES-THR444,RES-HID333"])
    assert.equal((await f.request(`/compare?codes=${codes}`)).response.status, 400, codes);
});

test("comparison returns only the caller's saved LISTED properties in requested order with a safe DTO", async t => {
  const f = await savedPropertiesFixture(t);
  await f.repository.save(f.owner, "RES-OTH222"); await f.repository.save(f.owner, "RES-THR444");
  const two = await f.request("/compare?codes=RES-THR444,RES-OTH222");
  assert.equal(two.response.status, 200); assert.deepEqual(two.payload.data.items.map((item: {code:string})=>item.code), ["RES-THR444","RES-OTH222"]);
  assert.equal(two.payload.data.items[0].propertyStatus,"Available"); assert.equal(two.payload.data.items[0].unitSizeSqft,null);
  const serialized=JSON.stringify(two.payload);
  for(const secret of [f.owner,f.other,f.foreignListing,"user_id","listing_status","public_id","documents"])assert(!serialized.includes(secret),secret);
  await f.repository.save(f.other,"RES-OWN111");
  const scoped=await f.request("/compare?codes=RES-OWN111,RES-OTH222");assert.deepEqual(scoped.payload.data.items.map((item:{code:string})=>item.code),["RES-OTH222"]);
  await f.db.query("update public.customer_listings set listing_status='PENDING' where id=$1",[f.foreignListing]);
  assert.deepEqual((await f.request("/compare?codes=RES-OTH222,RES-THR444")).payload.data.items.map((item:{code:string})=>item.code),["RES-THR444"]);
  assert.equal((await f.db.query<{count:number}>("select count(*)::integer count from public.customer_saved_properties")).rows[0]!.count,3,"comparison must not mutate saved relationships");
  assert.equal((await f.db.query<{count:number}>("select count(*)::integer count from public.customer_referral_links")).rows[0]!.count,0,"comparison must not create referrals");
});

test("three-property comparison is supported without changing listing ownership or lifecycle", async t => {
  const f=await savedPropertiesFixture(t);await f.repository.save(f.owner,"RES-OWN111");await f.repository.save(f.owner,"RES-OTH222");await f.repository.save(f.owner,"RES-THR444");
  const compared=await f.request("/compare?codes=RES-OWN111,RES-OTH222,RES-THR444");assert.equal(compared.payload.data.items.length,3);
  const rows=(await f.db.query<{user_id:string;listing_status:string}>("select user_id,listing_status from public.customer_listings order by listing_code")).rows;
  assert(rows.every(row=>row.listing_status==="LISTED"||row.listing_status==="PENDING"));assert.equal(rows.find(row=>row.user_id===f.owner)?.user_id,f.owner);
});
