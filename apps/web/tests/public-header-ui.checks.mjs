import assert from "node:assert/strict";
import { runIfMain } from "./run-ui-suite.mjs";

runIfMain(import.meta.url, "public-header");

export async function checkPublicHeader({ page, origin, calls, failures, screenshot, passed }) {
  const routes = ["/", "/about", "/careers", "/support", "/buy"];
  const trigger = page.locator(".public-account-trigger");
  const dropdown = page.locator(".public-account-dropdown");
  failures.set("/me", { status: 401, code: "UNAUTHENTICATED" });
  await page.goto(origin + "/");
  await page.getByRole("link", { name: "Login" }).waitFor();
  assert.equal(await trigger.count(), 0);
  assert.equal(await page.getByRole("link", { name: "Register" }).count(), 1);
  assert.equal(await page.getByRole("navigation", { name: "Public navigation" }).getByRole("link", { name: "Analytics & Insights" }).count(), 0);
  const signedOutSell = page.getByRole("navigation", { name: "Public navigation" }).getByRole("link", { name: "Sell — List a Property" });
  assert.equal(await signedOutSell.getAttribute("href"), "/sell");
  assert.equal(await signedOutSell.locator(".public-nav-sell-primary").innerText(), "Sell");
  assert.equal(await signedOutSell.locator(".public-nav-sell-secondary").innerText(), "List a Property");
  await page.goto(origin + "/sell");
  await page.getByRole("heading", { name: "Sign in to sell a property" }).waitFor();
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
    assert.equal(await nav.getByRole("link", { name: "Analytics & Insights" }).count(), 0, route);
    assert.equal(await nav.getByRole("link", { name: "Sell — List a Property" }).getAttribute("href"), "/sell", route);
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

  for (const width of [1440, 1280, 1024, 768, 430, 390, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + "/buy");
    if (width <= 700) await page.getByRole("button", { name: "Toggle navigation" }).click();
    assert.equal(await page.getByRole("navigation", { name: "Public navigation" }).getByRole("link", { name: "Analytics & Insights" }).count(), 0, `public navigation at ${width}`);
    await trigger.waitFor();
    assert.equal(await trigger.getAttribute("aria-haspopup"), "true");
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");
    await trigger.click();
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    await dropdown.waitFor();
    assert.deepEqual((await dropdown.locator(":scope > *").allTextContents()).map(value => value.trim()),
      ["My Dashboard", "Sell a Property", "Referrals", "Saved Property", "Compare Property", "Mortgage Calculator", "Log Out"]);
    const sellLink = page.getByRole("navigation", { name: "Public navigation" }).getByRole("link", { name: "Sell — List a Property" });
    assert.equal(await sellLink.count(), 1, `one Sell link at ${width}`);
    const sellSizes = await sellLink.evaluate(element => ({ primary: Number.parseFloat(getComputedStyle(element.querySelector(".public-nav-sell-primary")).fontSize), secondary: Number.parseFloat(getComputedStyle(element.querySelector(".public-nav-sell-secondary")).fontSize) }));
    assert.equal(sellSizes.primary > sellSizes.secondary, true, `Sell hierarchy at ${width}`);
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
    ["/dashboard", "/dashboard/listings/new", "/dashboard/referrals", "/saved-properties", "/compare-properties", "/mortgage-calculator"]);
  assert.equal(await dropdown.getByRole("link", { name: "Saved Property" }).getAttribute("href"), "/saved-properties");
  assert.equal(await dropdown.getByRole("link", { name: "Compare Property" }).getAttribute("href"), "/compare-properties");
  assert.equal(await dropdown.getByRole("link", { name: "Mortgage Calculator" }).getAttribute("href"), "/mortgage-calculator");
  await dropdown.getByRole("link", { name: "My Dashboard" }).click();
  await page.waitForURL("**/dashboard");
  await page.goto(origin + "/buy"); await trigger.waitFor();
  await page.getByRole("navigation", { name: "Public navigation" }).getByRole("link", { name: "Sell — List a Property" }).click();
  const sellPrompt=page.getByRole("dialog",{name:"Do you need assistance"});await sellPrompt.waitFor();await sellPrompt.getByRole("button",{name:"No",exact:true}).click();await page.waitForURL("**/dashboard/listings/new");
  for (const [label, path] of [["Sell a Property", "/dashboard/listings/new"], ["Referrals", "/dashboard/referrals"]]) {
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
  const retiredResponse = await page.goto(origin + "/analytics");
  assert.equal(retiredResponse?.status(), 404);
  assert.equal(await page.getByText("Analytics & Insights", { exact: true }).count(), 0);
  passed.push("Shared authenticated public header uses session identity on five public routes; signed-in Referrals redirects to dashboard");
  passed.push("Public desktop/mobile navigation omits Analytics & Insights and retired /analytics returns 404");
  passed.push("Signed-out controls, eight widths, two-line Sell hierarchy, menu toggle/outside/Escape, valid routes and existing logout work");
}
