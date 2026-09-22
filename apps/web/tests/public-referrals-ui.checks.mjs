import assert from "node:assert/strict";
import { runIfMain } from "./run-ui-suite.mjs";

runIfMain(import.meta.url, "public-referrals");

export async function checkPublicReferrals({ page, origin, calls, failures, screenshot, passed }) {
  const cards = page.locator(".public-referrals-card");
  failures.set("/me", { status: 401, code: "AUTH_REQUIRED" });
  for (const width of [1440, 1280, 768, 430, 390, 360]) {
    await page.setViewportSize({ width, height: 1051 });
    await page.goto(origin + "/referrals");
    await page.getByRole("heading", { name: "Refer a transaction" }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator(".public-nav a.active").innerText(), "Referrals");
    assert.equal(await cards.count(), 2);
    assert.deepEqual(await cards.locator("h2").allTextContents(), ["Refer someone to buy a property", "Refer someone to sell a property"]);
    const layout = await page.evaluate(() => {
      const [buy, sell] = [...document.querySelectorAll(".public-referrals-card")].map(card => card.getBoundingClientRect());
      return { overflow: document.documentElement.scrollWidth > innerWidth,
        beside: buy.right <= sell.left && Math.abs(buy.top - sell.top) < 1,
        stacked: buy.bottom < sell.top,
        footerVisible: getComputedStyle(document.querySelector(".site-footer")).display !== "none" };
    });
    assert.equal(layout.overflow, false, `Referrals overflow at ${width}`);
    assert.equal(layout.beside, width > 700);
    assert.equal(layout.stacked, width <= 700);
    assert.equal(layout.footerVisible, width > 900);
    assert.equal(await cards.locator("svg.public-referral-icon").count(), 2);
    assert.equal(await cards.locator("img").count(), 0);
    if (width === 1440 || width === 390) await screenshot(`public-referrals-${width}`);
  }
  assert.deepEqual(await cards.locator("a").evaluateAll(links => links.map(link => new URL(link.href).pathname + new URL(link.href).search)),
    ["/login?next=/buy", "/login?next=/dashboard/referrals"]);
  await cards.first().locator("a").click();
  await page.waitForURL(url => url.pathname === "/login" && url.searchParams.get("next") === "/buy");
  await page.locator("#login-identity").fill("test@example.test");
  await page.locator("#login-password").fill("TestingPass1!");
  await page.getByRole("button", { name: "Submit" }).click();
  await page.waitForURL(url => url.pathname === "/buy");
  await page.goto(origin + "/referrals");
  await cards.nth(1).locator("a").click();
  await page.waitForURL(url => url.pathname === "/login" && url.searchParams.get("next") === "/dashboard/referrals");
  failures.delete("/me");
  await page.goto(origin + "/referrals");
  await page.waitForURL("**/dashboard/referrals");
  assert.equal(await cards.count(), 0);
  assert.equal(calls.some(call => call.method === "POST" && (call.endpoint.includes("referral") || call.endpoint.includes("listing"))), false);
  passed.push("Public Referrals matches two-column desktop and stacked mobile design at six widths, with crisp SVG icons and no overflow");
  passed.push("Guest CTAs lead to login with Buy/Seller destinations; signed-in users redirect to dashboard referrals without generating a link");
}
