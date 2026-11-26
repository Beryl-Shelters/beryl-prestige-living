import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { listingOptions } from "../src/listings/model.js";

test("property subtype migration preserves historical rows and accepts the API taxonomy", async () => {
  const db = new PGlite();
  try {
    const old = listingOptions.property_subtype.slice(0, 8).map(value => `'${value}'`).join(",");
    await db.exec(`
      create table public.customer_listings (property_subtype text not null constraint customer_listings_property_subtype_check check (property_subtype in (${old})));
      create table public.public_buy_assistance_requests (property_subtype text constraint public_buy_assistance_requests_property_subtype_check check (property_subtype is null or property_subtype in (${old})));
      create table public.customer_completed_purchases (
        property_type text not null,
        property_subtype text constraint customer_completed_purchases_property_subtype_check check (property_subtype is null or property_subtype in (${old})),
        constraint completed_purchase_type_check check ((property_type='Residential' and property_subtype is not null) or (property_type='Commercial' and property_subtype is null))
      );
      insert into public.customer_listings values ('Bungalow');
      insert into public.public_buy_assistance_requests values ('Bungalow'), (null);
      insert into public.customer_completed_purchases values ('Residential','Bungalow'), ('Commercial',null);
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/20261126001107_expand_property_subtypes.sql", import.meta.url), "utf8"));
    for (const subtype of listingOptions.property_subtype) {
      await db.query("insert into public.customer_listings values ($1)", [subtype]);
      await db.query("insert into public.public_buy_assistance_requests values ($1)", [subtype]);
      await db.query("insert into public.customer_completed_purchases values ('Residential',$1)", [subtype]);
    }
    await db.query("insert into public.customer_completed_purchases values ('Commercial','Warehouse')");
    const count = await db.query<{ total: number }>("select count(*)::int total from public.customer_listings");
    assert.equal(count.rows[0]?.total, listingOptions.property_subtype.length + 1);
    await assert.rejects(db.query("insert into public.customer_listings values ('Unknown Type')"));
    await assert.rejects(db.query("insert into public.public_buy_assistance_requests values ('Unknown Type')"));
  } finally {
    await db.close();
  }
});
