import express from "express";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loginRateLimiter } from "./auth-rate-limiters";

describe("customer login rate limiter", () => {
  const app = express();
  app.use(express.json());
  app.post("/login", loginRateLimiter, (_req, res) => {
    res.status(200).json({ success: true });
  });

  let server: ReturnType<typeof app.listen>;
  let url: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as AddressInfo;
    url = `http://127.0.0.1:${address.port}/login`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  const attempt = (identifier: string) =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier })
    });

  it("limits each normalized IP-and-identifier pair after ten attempts", async () => {
    for (let attemptNumber = 1; attemptNumber <= 10; attemptNumber += 1) {
      expect((await attempt("CUSTOMER@example.com")).status).toBe(200);
    }

    const limited = await attempt("customer@example.com");
    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toMatchObject({
      success: false,
      code: "LOGIN_RATE_LIMITED"
    });

    expect((await attempt("another@example.com")).status).toBe(200);
  });
});
