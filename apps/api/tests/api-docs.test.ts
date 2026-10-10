import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "../src/app.js";

async function withServer(enableApiDocs: boolean, run: (origin: string) => Promise<void>) {
  const server = createApp({ webAppUrl: undefined, enableApiDocs }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("development exposes interactive Swagger docs with the current API origin", async () => {
  await withServer(true, async (origin) => {
    const specification = await fetch(`${origin}/api-docs/openapi.json`);
    assert.equal(specification.status, 200);
    const document = await specification.json() as {
      openapi: string;
      servers: { url: string }[];
      paths: Record<string, unknown>;
    };
    assert.equal(document.openapi, "3.0.3");
    assert.equal(document.servers[0]?.url, origin);
    assert(document.paths["/api/v1/auth/login"]);
    assert(document.paths["/api/v1/listings"]);

    const page = await fetch(`${origin}/api-docs/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Beryl Shelter API Docs/);

    const initializer = await fetch(`${origin}/api-docs/swagger-ui-init.js`);
    assert.equal(initializer.status, 200);
    assert.match(await initializer.text(), /api-docs\/openapi\.json/);
  });
});

test("Swagger docs stay disabled when development docs are not enabled", async () => {
  await withServer(false, async (origin) => {
    assert.equal((await fetch(`${origin}/api-docs/openapi.json`)).status, 404);
    assert.equal((await fetch(`${origin}/api-docs/`)).status, 404);
  });
});
