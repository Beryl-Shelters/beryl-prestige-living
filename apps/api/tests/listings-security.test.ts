import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { parseContent } from "../src/listings/model.js";
import { ListingsService } from "../src/listings/service.js";
import type { CleanupAsset, ListingsRepository } from "../src/listings/repository.js";
import { imageBytes, listingFixture, listingForm, validContent } from "./listings.fixture.js";

test("Listings security boundaries against disposable local PostgreSQL", async t => {
  const f = await listingFixture(t);
  const service = new ListingsService(f.repository, f.storage);
  const create = async () => {
    const result = await f.request("", "POST", listingForm());
    assert.equal(result.response.status, 201, JSON.stringify(result.payload));
    return (await f.repository.get(f.owner, result.payload.data.id))!;
  };
  const age = () => f.db.exec("update public.customer_listing_media_cleanup set created_at=clock_timestamp()-interval '2 hours'");
  const rpc = (params: unknown[]) => f.db.query("select public.mutate_customer_listing($1,$2,$3,$4,$5,$6,$7)", params);

  await t.test("composite identity isolates raw/authenticated from a referenced image/upload", async () => {
    const listing = await create();
    const image = listing.images[0]!;
    const raw: CleanupAsset = { public_id: image.public_id, resource_type: "raw", delivery_type: "authenticated" };
    await f.repository.journal(f.owner, image);
    await f.repository.journal(f.owner, raw);
    await age();
    assert.equal(await f.repository.referenced(f.other, image), true);
    assert.equal(await f.repository.referenced(f.owner, raw), false);
    assert.equal(await f.repository.claimCleanup(f.other, raw), false);
    const deleted: CleanupAsset[] = [];
    await new ListingsService(f.repository, { ...f.storage, remove: async asset => { deleted.push(asset); } }).cleanup(f.owner);
    assert.deepEqual(deleted, [raw]);
    const remaining = await f.db.query<CleanupAsset>("select public_id,resource_type,delivery_type from public.customer_listing_media_cleanup where public_id=$1", [image.public_id]);
    assert.deepEqual(remaining.rows, [{ public_id: image.public_id, resource_type: "image", delivery_type: "upload" }]);
  });

  await t.test("retained image survives queued cleanup before and after Edit; acknowledgement is transactional", async () => {
    const listing = await create();
    const asset = listing.images[0]!;
    await f.repository.journal(f.owner, asset);
    await age();
    await service.cleanup(f.owner, [asset]);
    assert(!f.removed.includes(asset.public_id));
    const result = await service.save(f.owner, listing.id, { content: { ...validContent, title: "Retained" }, version: listing.version, retained_images: [asset.id] }, []);
    assert.equal(result.images[0]!.id, asset.id);
    await service.cleanup(f.owner, [asset]);
    assert(!f.removed.includes(asset.public_id));
    assert.equal((await f.db.query("select * from public.customer_listing_media_cleanup where public_id=$1", [asset.public_id])).rows.length, 0);
    assert.equal(await f.repository.claimCleanup(f.owner, asset), false);
  });

  await t.test("cleanup claim wins against late upload attachment; provider failure remains retryable", async () => {
    const asset = { public_id: `late-${randomUUID()}`, resource_type: "image" as const, delivery_type: "upload" as const };
    await f.repository.journal(f.owner, asset);
    assert.equal(await f.repository.claimCleanup(f.owner, asset), false, "fresh in-flight upload is protected");
    await age();
    assert.equal(await f.repository.claimCleanup(f.owner, asset), true);
    const images = [{ ...asset, id: randomUUID(), url: "https://images.example.test/image.png", mime_type: "image/png", size_bytes: imageBytes.length, sort_order: 0 }];
    await assert.rejects(() => rpc([f.owner, null, "CREATE", null, JSON.stringify(parseContent(validContent)), JSON.stringify(images), "[]"]), /Upload is not available/);
    f.failures.remove = true;
    await service.cleanup(f.owner, [asset]);
    assert.equal(await f.repository.claimCleanup(f.owner, asset), true, "failed removal can be retried");
    f.failures.remove = false;
    await service.cleanup(f.owner, [asset]);
    assert(f.removed.includes(asset.public_id));
    assert.equal(await f.repository.claimCleanup(f.owner, asset), false);
  });

  await t.test("delete between save commit and response cannot lose its cleanup intent", async () => {
    const repository: ListingsRepository = Object.create(f.repository);
    let deletedAsset: CleanupAsset | undefined;
    repository.mutate = async (owner, value) => {
      const id = await f.repository.mutate(owner, value);
      const current = (await f.repository.get(owner, id))!;
      deletedAsset = current.images[0]!;
      await f.repository.mutate(owner, { id, action: "DELETE", version: current.version });
      return id;
    };
    await assert.rejects(() => new ListingsService(repository, f.storage).save(f.owner, null, { content: validContent }, [{ field: "images", mime: "image/png", bytes: imageBytes }]));
    assert(deletedAsset);
    assert.equal(await f.repository.claimCleanup(f.owner, deletedAsset), true);
    await service.cleanup(f.owner, [deletedAsset]);
    assert(f.removed.includes(deletedAsset.public_id));
  });

  await t.test("SQL NULL, JSON null, wrong shapes, null elements and malformed records fail closed atomically", async () => {
    const listing = await create();
    const base: unknown[] = [f.owner, listing.id, "EDIT", listing.version, JSON.stringify(parseContent(validContent)), JSON.stringify(listing.images), "[]"];
    for (const index of [4, 5, 6]) {
      const invalid = index === 4 ? [null, "null", "[]", '"text"', "true"] : [null, "null", "{}", '"text"', "true", "[null]", "[1]"];
      for (const value of invalid) {
        const params = [...base]; params[index] = value;
        await assert.rejects(() => rpc(params));
        assert.deepEqual(await f.repository.get(f.owner, listing.id), listing);
      }
    }
    for (const images of ["[]", "[{}]"]) await assert.rejects(() => rpc([...base.slice(0, 5), images, "[]"]));
    for (const docs of [null, "null", "[]", "[{}]", "[{},{}]", "[null,null]"]) {
      await assert.rejects(() => rpc([f.owner, listing.id, "DOCUMENTS", listing.version, "{}", "[]", docs]));
    }
    for (const index of [0, 2, 3]) { const params = [...base]; params[index] = null; await assert.rejects(() => rpc(params)); }
    assert.deepEqual(await f.repository.get(f.owner, listing.id), listing);
  });

  await t.test("service-only definer functions and RLS deny customer execution and direct table writes", async () => {
    const functions = ["public.mutate_customer_listing(uuid,uuid,text,integer,jsonb,jsonb,jsonb)", "public.claim_customer_listing_cleanup(uuid,text,text,text)"];
    for (const fn of functions) {
      const config = await f.db.query<{prosecdef:boolean;proconfig:string[]}>("select prosecdef,proconfig from pg_proc where oid=$1::regprocedure", [fn]);
      assert.equal(config.rows[0]!.prosecdef, true);
      assert(config.rows[0]!.proconfig.includes("search_path=public, pg_temp"));
      for (const role of ["anon", "authenticated", "service_role"]) {
        const privileges = await f.db.query<{allowed:boolean}>("select has_function_privilege($1,$2,'execute') as allowed", [role, fn]);
        assert.equal(privileges.rows[0]!.allowed, role === "service_role");
      }
    }
    for (const role of ["anon", "authenticated"]) {
      for (const table of ["customer_listings", "customer_listing_images", "customer_listing_documents", "customer_listing_media_cleanup"]) {
        const privileges = await f.db.query<{allowed:boolean}>("select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') as allowed", [role, `public.${table}`]);
        assert.equal(privileges.rows[0]!.allowed, false);
      }
    }
  });

  await t.test("customer status/owner spoofing cannot establish moderation states or foreign ownership", async () => {
    let listing = await create();
    for (const status of ["LISTED", "REJECTED"]) {
      await assert.rejects(() => rpc([f.owner, listing.id, status, listing.version, "{}", "[]", "[]"]));
      await rpc([f.owner, listing.id, "EDIT", listing.version, JSON.stringify({ ...parseContent(validContent), user_id: f.other, listing_status: status }), JSON.stringify(listing.images), "[]"]);
      listing = (await f.repository.get(f.owner, listing.id))!;
      assert.equal(listing.listing_status, "UNLISTED");
      assert.equal(listing.user_id, f.owner);
    }
    await assert.rejects(() => rpc([f.other, listing.id, "DELETE", listing.version, "{}", "[]", "[]"]), /Listing not found/);
  });

  await t.test("money round trips at one kobo and maximum without binary rounding or overflow", async () => {
    for (const [value, minor] of [["0.01", 1], ["9999999999999.99", 999999999999999]] as const) {
      const result = await f.request("", "POST", listingForm({ ...validContent, property_cost: value, minimum_down_payment: value }));
      assert.equal(result.response.status, 201);
      assert.equal(result.payload.data.property_cost_minor, minor);
      assert.equal(result.payload.data.minimum_down_payment_minor, minor);
      const db = await f.db.query<{amount:string}>("select property_cost_minor::text as amount from customer_listings where id=$1", [result.payload.data.id]);
      assert.equal(db.rows[0]!.amount, String(minor));
    }
    for (const value of ["10000000000000", "9007199254740993", "0.001", "1e3", "NaN", "-1"]) {
      assert.throws(() => parseContent({ ...validContent, property_cost: value }));
    }
  });

  await t.test("media UUIDs are server-authoritative and document endpoints hide non-owned files", async () => {
    const before = f.uploaded.length;
    const forged = randomUUID();
    assert.equal((await f.request("", "POST", listingForm(validContent, undefined, { images: [{ id: forged }] }))).response.status, 400);
    assert.equal(f.uploaded.length, before);
    const listing = await create();
    assert.equal((await f.request(`/${listing.id}`, "PATCH", listingForm(validContent, [], { version: listing.version, retained_images: [forged] }))).response.status, 404);
    const body = new FormData();
    body.set("data", JSON.stringify({ title: "Private", document_type: "Other", description: "One", version: listing.version }));
    body.set("document", new Blob(["%PDF-1.4 test"], {type:"application/pdf"}), "private.pdf");
    const result = await f.request(`/${listing.id}/documents`, "POST", body);
    assert.equal(result.response.status, 201);
    assert(!JSON.stringify(result.payload.data.documents).match(/public_id|cloudinary|url|secret/));
    const docId = result.payload.data.documents[0].id;
    const otherListing = await create();
    assert.equal((await f.request(`/${otherListing.id}/documents/${docId}`)).response.status, 404);
    assert.equal((await f.request(`/${listing.id}/documents/${docId}`, "GET", undefined, {Cookie:""})).response.status, 401);
    const foreign = await service.save(f.other, null, { content: validContent }, [{ field: "images", mime: "image/png", bytes: imageBytes }]);
    const foreignDocs = await service.documents(f.other, foreign.id, { title:"Foreign", document_type:"Other", description:"One", version:foreign.version }, [{ field:"document", mime:"application/pdf", bytes:Buffer.from("%PDF-1.4 test") }]);
    assert.equal((await f.request(`/${foreign.id}`)).response.status, 404);
    assert.equal((await f.request(`/${foreign.id}/documents/${foreignDocs.documents[0]!.id}`)).response.status, 404);
  });
});
