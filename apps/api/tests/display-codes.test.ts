import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { authConfigSchema } from "../src/auth/config.js";
import { SupabaseListingsRepository } from "../src/listings/repository.js";
import { listingFixture, listingForm, validContent } from "./listings.fixture.js";

test("short-code migration preserves old identifiers and generates compact future codes", async t => {
  const f = await listingFixture(t, false);
  const legacy = await f.request("", "POST", listingForm());
  assert.equal(legacy.response.status, 201);
  assert.match(legacy.payload.data.listing_code, /^BRL-[A-F0-9]{16}$/);
  await f.db.exec(await readFile(new URL("../supabase/migrations/202609100001_short_display_codes.sql", import.meta.url), "utf8"));
  const old = await f.request(`/${legacy.payload.data.id}`);
  assert.equal(old.payload.data.listing_code, legacy.payload.data.listing_code);
  assert.equal(old.payload.data.referral_url, legacy.payload.data.referral_url);

  for (const [type, prefix] of [["Residential", "RES"], ["Commercial", "COM"]]) {
    const content = { ...validContent, property_type: type };
    const result = await f.request("", "POST", listingForm(content));
    assert.equal(result.response.status, 201, JSON.stringify(result.payload));
    const listing = result.payload.data;
    assert.match(listing.listing_code, new RegExp(`^${prefix}-[A-HJ-NP-Z2-9]{6}$`));
    assert.equal(listing.listing_code.length, 10);
    assert(listing.referral_url.includes(`/properties/${listing.listing_code}?`));
    assert.equal((await f.request(`?q=${listing.listing_code}`)).payload.data.total, 1);
    const edited = await f.request(`/${listing.id}`, "PATCH", listingForm({ ...content, property_type: type === "Residential" ? "Commercial" : "Residential" }, [], { version: listing.version }));
    assert.equal(edited.response.status, 200);
    assert.equal(edited.payload.data.listing_code, listing.listing_code, "code is permanent even if property type changes");
    await assert.rejects(() => f.db.query(
      "insert into public.customer_listings select (jsonb_populate_record(null::public.customer_listings, to_jsonb(l)||jsonb_build_object('id',gen_random_uuid()))).* from public.customer_listings l where id=$1",
      [listing.id]), (error: unknown) => (error as {code:string}).code === "23505");
  }

  const codes = await f.db.query<{code:string}>("select public.generate_display_code('REF') as code from generate_series(1,256)");
  for (const {code} of codes.rows) assert.match(code, /^REF-[A-HJ-NP-Z2-9]{6}$/);
  for (const prefix of [null, "", "ref", "REF-", "LONG", " REF"]) {
    await assert.rejects(() => f.db.query("select public.generate_display_code($1)", [prefix]));
  }
  for (const fn of ["public.generate_display_code(text)", "public.assign_customer_listing_code()"]) {
    for (const role of ["anon", "authenticated", "service_role"]) {
      const result = await f.db.query<{allowed:boolean}>("select has_function_privilege($1,$2,'execute') as allowed", [role, fn]);
      assert.equal(result.rows[0]!.allowed, role === "service_role");
    }
  }
});

test("listing code collisions retry only CREATE, remain bounded and do not retry other unique failures", async t => {
  const config = authConfigSchema.parse({ webOrigin:"http://localhost:3000", apiOrigin:"http://localhost:4000", supabaseUrl:"https://example.supabase.co", anonKey:"test", serviceKey:"test", encryptionKey:Buffer.alloc(32).toString("base64"), cookieSecure:false, production:false });
  const repository = new SupabaseListingsRepository(config);
  const savedId = randomUUID();
  let calls = 0;
  let failures = 1;
  let constraint = "customer_listings_listing_code_key";
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    assert(String(input).endsWith("/rest/v1/rpc/mutate_customer_listing"));
    calls++;
    return calls <= failures
      ? new Response(JSON.stringify({ code:"23505", message:`duplicate key value violates unique constraint "${constraint}"` }), { status:409, headers:{"Content-Type":"application/json"} })
      : new Response(JSON.stringify(savedId), { status:200, headers:{"Content-Type":"application/json"} });
  });
  const create = { action:"CREATE" as const, id:null, version:null };
  assert.equal(await repository.mutate(randomUUID(), create), savedId);
  assert.equal(calls, 2);
  calls = 0; failures = 10;
  await assert.rejects(() => repository.mutate(randomUUID(), create));
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(() => repository.mutate(randomUUID(), { action:"EDIT", id:savedId, version:1 }));
  assert.equal(calls, 1);
  calls = 0; constraint = "customer_listing_images_public_id_key";
  await assert.rejects(() => repository.mutate(randomUUID(), create));
  assert.equal(calls, 1);
});
