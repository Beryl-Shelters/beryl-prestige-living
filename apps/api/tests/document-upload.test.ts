import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { listingFixture, listingForm } from "./listings.fixture.js";

test("documents require one description and exactly one file, with matching SQL enforcement", async t => {
  const f = await listingFixture(t);
  const created = await f.request("", "POST", listingForm());
  assert.equal(created.response.status, 201);
  const {id, version} = created.payload.data;
  const metadata = {title:"Deed",document_type:"Ownership",description:"This is the deed of the house.",version};
  const form = (data:unknown, fields:string[]) => {
    const body = new FormData();
    body.set("data", JSON.stringify(data));
    for (const field of fields) body.append(field, new Blob(["%PDF-1.4 test"], {type:"application/pdf"}), "deed.pdf");
    return body;
  };
  const before = f.uploaded.length;
  for (const fields of [[], ["document","document"], ["document1"], ["document1","document2"]]) {
    assert.equal((await f.request(`/${id}/documents`, "POST", form(metadata,fields))).response.status, 400);
  }
  for (const data of [
    {...metadata,description:""}, {...metadata,description:"   "}, {...metadata,description:"x".repeat(2001)},
    {...metadata,description:undefined}, {...metadata,descriptions:["One","Two"]},
  ]) {
    assert.equal((await f.request(`/${id}/documents`, "POST", form(data,["document"]))).response.status, 400);
  }
  assert.equal(f.uploaded.length, before, "invalid submissions never reach storage");
  const uploaded = await f.request(`/${id}/documents`, "POST", form(metadata,["document"]));
  assert.equal(uploaded.response.status, 201, JSON.stringify(uploaded.payload));
  assert.equal(uploaded.payload.data.documents.length, 1);
  assert.equal(uploaded.payload.data.documents[0].description, metadata.description);
  const current = (await f.repository.get(f.owner,id))!;
  const pair = [0,1].map(sort_order => ({...current.documents[0]!,public_id:`document-test-${randomUUID()}.pdf`,sort_order}));
  for (const asset of pair) await f.repository.journal(f.owner,asset);
  await assert.rejects(() => f.repository.mutate(f.owner,{action:"DOCUMENTS",id,version:current.version,documents:pair}));
  assert.deepEqual(await f.repository.get(f.owner,id),current, "two-file SQL mutation rolls back");
  await f.repository.mutate(f.owner,{action:"DOCUMENTS",id,version:current.version,documents:[pair[0]!]});
  const after = (await f.repository.get(f.owner,id))!;
  assert.equal(after.documents.length,2, "additional documents can still be uploaded separately");
  assert(after.documents.some(doc => doc.id === current.documents[0]!.id), "existing document is preserved");
  assert(after.documents.every(doc => doc.delivery_type === "authenticated" && doc.resource_type === "raw"));
});
