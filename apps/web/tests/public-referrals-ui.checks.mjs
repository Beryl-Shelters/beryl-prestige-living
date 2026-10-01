import assert from "node:assert/strict";
import { runIfMain } from "./run-ui-suite.mjs";

runIfMain(import.meta.url, "public-referrals");

export async function checkPublicReferrals({ page, origin, calls, failures, screenshot, passed }) {
  const cards = page.locator(".public-referrals-card");
  failures.set("/me", { status: 401, code: "AUTH_REQUIRED" });
  for (const width of [1440, 768, 390, 320]) {
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
    assert.equal(layout.footerVisible, true);
    assert.equal(await cards.locator("svg.public-referral-icon").count(), 2);
    assert.equal(await cards.locator("img").count(), 0);
    await cards.first().getByRole("button", { name: /Click Here/ }).click();
    const modal = page.getByRole("dialog", { name: "Sign in to refer a friend" }); await modal.waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Referral modal overflow at ${width}`);
    assert.equal(await modal.getByRole("link", { name: "Create free account" }).getAttribute("href"), "/register?next=%2Fbuy");
    assert.equal(await modal.getByRole("link", { name: "Log In" }).getAttribute("href"), "/login?next=%2Fbuy");
    if(width===1440){assert.equal(await modal.getByRole("button",{name:"Close referral sign-in prompt"}).evaluate(element=>element===document.activeElement),true);await page.keyboard.press("Shift+Tab");assert.equal(await modal.getByRole("link",{name:"Log In"}).evaluate(element=>element===document.activeElement),true);await page.keyboard.press("Tab");assert.equal(await modal.getByRole("button",{name:"Close referral sign-in prompt"}).evaluate(element=>element===document.activeElement),true);}
    if (width === 1440 || width === 390) await screenshot(`public-referrals-modal-${width}`);
    await modal.getByRole("button", { name: "Close referral sign-in prompt" }).click(); assert.equal(await modal.count(), 0);
    assert.equal(await cards.first().getByRole("button", { name: /Click Here/ }).evaluate(element => element === document.activeElement), true);
    if (width === 1440 || width === 390) await screenshot(`public-referrals-${width}`);
  }
  await cards.first().getByRole("button", { name: /Click Here/ }).click(); await page.keyboard.press("Escape"); assert.equal(await page.getByRole("dialog", { name: "Sign in to refer a friend" }).count(), 0);
  await cards.first().getByRole("button", { name: /Click Here/ }).click();
  await page.getByRole("dialog", { name: "Sign in to refer a friend" }).getByRole("link", { name: "Log In" }).click();
  await page.waitForURL(url => url.pathname === "/login" && url.searchParams.get("next") === "/buy");
  await page.locator("#login-identity").fill("test@example.test");
  await page.locator("#login-password").fill("TestingPass1!");
  await page.getByRole("button", { name: "Submit" }).click();
  await page.waitForURL(url => url.pathname === "/buy");
  await page.goto(origin + "/referrals");
  await cards.nth(1).getByRole("button", { name: /Click Here/ }).click();
  const sellerModal=page.getByRole("dialog",{name:"Sign in to refer a friend"});
  assert.equal(await sellerModal.getByRole("link",{name:"Create free account"}).getAttribute("href"),"/register?next=%2Fdashboard%2Freferrals");
  assert.equal(await sellerModal.getByRole("link",{name:"Log In"}).getAttribute("href"),"/login?next=%2Fdashboard%2Freferrals");
  failures.delete("/me");
  await page.goto(origin + "/referrals");
  await page.waitForURL("**/dashboard/referrals");
  assert.equal(await cards.count(), 0);
  assert.equal(calls.some(call => call.method === "POST" && (call.endpoint.includes("referral") || call.endpoint.includes("listing"))), false);
  passed.push("Public Referrals matches the supplied desktop/mobile card design at four widths with scalable icons and no overflow");
  passed.push("Guest CTAs open an accessible non-persisted sign-in/register gate with safe Buy/Seller destinations; signed-in users redirect to dashboard referrals without generating a link");
}
