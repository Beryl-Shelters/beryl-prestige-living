import express from "express";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { locationSearchRateLimiter } from "../../middlewares/auth-rate-limiters";

describe("public location-search rate limit", () => {
  const app = express();
  app.get("/locations/search", locationSearchRateLimiter, (_req, res) => {
    res.json({ success: true });
  });

  let server: ReturnType<typeof app.listen>;
  let url: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as AddressInfo;
    url = `http://127.0.0.1:${address.port}/locations/search?q=Ile`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("blocks requests after the bounded public allowance", async () => {
    for (let request = 1; request <= 60; request += 1) {
      expect((await fetch(url)).status).toBe(200);
    }
    const limited = await fetch(url);
    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toMatchObject({
      success: false,
      code: "LOCATION_SEARCH_RATE_LIMITED",
    });
  });
});
