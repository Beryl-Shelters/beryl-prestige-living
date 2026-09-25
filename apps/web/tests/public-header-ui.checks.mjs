import assert from "node:assert/strict";
import { runIfMain } from "./run-ui-suite.mjs";

runIfMain(import.meta.url, "public-header");

export async function checkPublicHeader({ page, origin, calls, failures, screenshot, passed }) {
  const routes = ["/", "/about", "/careers", "/analytics", "/support", "/buy"];
  const trigger = page.locator(".public-account-trigger");
  const dropdown = page.locator(".public-account-dropdown");
  failures.set("/me", { status: 401, code: "UNAUTHENTICATED" });
  await page.goto(origin + "/");
  await page.getByRole("link", { name: "Login" }).waitFor();
  assert.equal(await trigger.count(), 0);
  assert.equal(await page.getByRole("link", { name: "Register" }).count(), 1);
  assert.equal(await page.getByRole("navigation", { name: "Public navigation" }).getByRole("link", { name: "Sell / List a Property" }).getAttribute("href"), "/sell");
  await page.goto(origin + "/sell");
  await page.getByRole("heading", { name: "Sign in to list a property" }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Create free account" }).getAttribute("href"), "/register?next=%2Fdashboard%2Flistings%2Fnew");
  assert.equal(await page.getByRole("link", { name: "Log In" }).getAttribute("href"), "/login?next=%2Fdashboard%2Flistings%2Fnew");
  failures.delete("/me");

  for (const route of routes) {
    await page.goto(origin + route);
    await trigger.waitFor();
    assert.equal(await trigger.innerText().then(value => value.includes("Ada Okafor")), true, route);
    assert.equal(await trigger.innerText().then(value => value.includes("Akinbote Temiloluwa")), false, route);
    assert.equal(await page.locator(".header-actions > .header-button").count(), 0, route);
    assert.equal(await page.locator(".header-actions .public-account-menu").count(), 1, route);
    const nav = page.getByRole("navigation", { name: "Public navigation" });
    assert.equal(await nav.getByRole("link", { name: "Sell / List a Property" }).getAttribute("href"), "/dashboard/listings/new", route);
    assert.equal(await nav.getByRole("link", { name: "Buy", exact: true }).getAttribute("href"), "/buy", route);
  }
  await page.goto(origin + "/referrals"); await page.waitForURL("**/dashboard/referrals");
  await page.goto(origin + "/sell"); await page.waitForURL("**/dashboard/listings/new");

  await page.goto(origin + "/"); await trigger.waitFor();
  assert.equal(await page.getByRole("link", { name: "My Dashboard" }).first().getAttribute("href"), "/dashboard");
  assert.equal(await page.getByRole("link", { name: /Click here to refer someone to buy/i }).getAttribute("href"), "/buy");
  assert.equal(await page.getByRole("link", { name: /Click here to refer someone to sell/i }).getAttribute("href"), "/dashboard/referrals");
  await page.getByRole("link", { name: /Click here to refer someone to buy/i }).click(); await page.waitForURL("**/buy");
  await page.goto(origin + "/"); await trigger.waitFor();
  await page.getByRole("link", { name: /Click here to refer someone to sell/i }).click(); await page.waitForURL("**/dashboard/referrals");

  for (const width of [1440, 1280, 768, 430, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + "/buy");
    if (width <= 700) await page.getByRole("button", { name: "Toggle navigation" }).click();
    await trigger.waitFor();
    assert.equal(await trigger.getAttribute("aria-haspopup"), "true");
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");
    await trigger.click();
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    await dropdown.waitFor();
    assert.deepEqual((await dropdown.locator(":scope > *").allTextContents()).map(value => value.trim()),
      ["My Dashboard", "List Property", "Referrals", "Saved Property", "Compare Property", "Mortgage Calculator", "Log Out"]);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `header overflow at ${width}`);
    if (width > 700) {
      assert.equal(await dropdown.evaluate(element => getComputedStyle(element).position), "absolute");
      assert.equal(await dropdown.evaluate(element => element.getBoundingClientRect().left >= 0 && element.getBoundingClientRect().right <= innerWidth), true);
    }
    if (width === 1440 || width === 390) await screenshot(`public-header-${width}`);
    await trigger.click(); assert.equal(await dropdown.count(), 0);
    await trigger.click(); await page.keyboard.press("Escape"); assert.equal(await dropdown.count(), 0);
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
    if (width > 700) {
      await trigger.click(); await page.getByRole("heading", { name: "Buy", exact: true }).click();
      assert.equal(await dropdown.count(), 0);
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(origin + "/buy"); await trigger.waitFor(); await trigger.click();
  assert.deepEqual(await dropdown.locator("a").evaluateAll(elements => elements.map(element => element.getAttribute("href"))),
    ["/dashboard", "/dashboard/listings/new", "/dashboard/referrals", "/saved-properties"]);
  assert.equal(await dropdown.getByRole("link", { name: "Saved Property" }).getAttribute("href"), "/saved-properties");
  for (const label of ["Compare Property", "Mortgage Calculator"]) {
    const item = dropdown.getByRole("button", { name: label });
    assert.equal(await item.getAttribute("aria-disabled"), "true");
    assert.equal(await item.isEnabled(), false);
    await item.dispatchEvent("click"); assert.equal(new URL(page.url()).pathname, "/buy");
  }
  await dropdown.getByRole("link", { name: "My Dashboard" }).click();
  await page.waitForURL("**/dashboard");
  await page.goto(origin + "/buy"); await trigger.waitFor();
  await page.getByRole("navigation", { name: "Public navigation" }).getByRole("link", { name: "Sell / List a Property" }).click();
  await page.waitForURL("**/dashboard/listings/new");
  for (const [label, path] of [["List Property", "/dashboard/listings/new"], ["Referrals", "/dashboard/referrals"]]) {
    await page.goto(origin + "/buy"); await trigger.waitFor(); await trigger.click();
    assert.equal(await dropdown.getByRole("link", { name: label }).getAttribute("href"), path);
    await dropdown.getByRole("link", { name: label }).click(); await page.waitForURL(`**${path}`);
  }
  await page.goto(origin + "/buy"); await trigger.waitFor(); await trigger.click();
  await dropdown.getByRole("link", { name: "Saved Property" }).click(); await page.waitForURL("**/saved-properties");
  await page.goto(origin + "/buy"); await trigger.waitFor(); await trigger.click();
  const beforeLogout = calls.filter(call => call.endpoint === "/logout").length;
  await dropdown.getByRole("button", { name: "Log Out" }).click();
  await page.getByRole("link", { name: "Login" }).waitFor();
  assert.equal(calls.filter(call => call.endpoint === "/logout").length, beforeLogout + 1);
  passed.push("Shared authenticated public header uses session identity on six public routes; signed-in Referrals redirects to dashboard");
  passed.push("Signed-out controls, six widths, menu toggle/outside/Escape, truthful unavailable items, valid routes and existing logout work");
}
