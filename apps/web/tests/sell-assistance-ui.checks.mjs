import assert from "node:assert/strict";
import { runIfMain } from "./run-ui-suite.mjs";

runIfMain(import.meta.url, "sell-assistance");
export async function checkSellAssistance({ page, origin, calls, failures, screenshot, passed, pauseRequest, resume }) {
  const navSell = () => page.getByRole("navigation", { name: "Public navigation" }).getByRole("link", { name: "Sell / List a Property" });
  const prompt = page.getByRole("dialog", { name: "Do you need assistance" });
  await page.goto(origin + "/buy"); await navSell().click(); await prompt.waitFor(); await screenshot("sell-decision-1440");
  await prompt.getByRole("button", { name: "Close sell assistance prompt" }).click(); assert.equal(await prompt.count(), 0); assert.equal(await navSell().evaluate(element => element === document.activeElement), true);
  await navSell().click(); await page.keyboard.press("Escape"); assert.equal(await prompt.count(), 0);
  await navSell().click(); await prompt.getByRole("button", { name: "No", exact: true }).click(); await page.waitForURL("**/dashboard/listings/new");
  await page.goto(origin + "/buy"); await navSell().click(); await prompt.getByRole("button", { name: "Yes", exact: true }).click(); await page.waitForURL("**/sell/assistance");
  await page.getByRole("heading", { name: "Tell us about your property" }).waitFor(); const contactName = page.getByLabel(/1\. Contact Name/); await page.waitForFunction(() => [...document.querySelectorAll("input")].some(input => input.value === "Ada Okafor")); assert.equal(await contactName.inputValue(), "Ada Okafor");
  await page.getByRole("button", { name: "Submit", exact: true }).click(); assert.equal(await page.getByRole("alert").count() >= 4, true);
  await page.getByLabel(/2\. Preferred Contact Method/).selectOption("Email"); assert.equal(await page.getByLabel("Contact Email *").inputValue(), "ada@example.test");
  await page.getByLabel(/4\. What Location/).fill("Lekki, Lagos"); await page.getByLabel(/5\. What type of property/).selectOption("Residential");
  await page.getByLabel(/13\. How much/).fill("50000000"); await page.getByLabel(/14\. Have you authorized/).selectOption("Yes");
  await page.getByRole("button", { name: "Submit", exact: true }).click(); await page.getByText("Upload the authorization document").waitFor();
  await page.getByLabel(/8\. Upload picture/).setInputFiles({ name: "property.png", mimeType: "image/png", buffer: Buffer.from([137,80,78,71,13,10,26,10,0]) });
  await page.getByLabel(/15\. Upload Authorization/).setInputFiles({ name: "authorization.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
  await page.getByLabel("CCTV").check(); const paused = pauseRequest("/public/sell-assistance"); await page.getByRole("button", { name: "Submit", exact: true }).click(); await paused; assert.equal(await page.getByRole("button", { name: "Submitting…" }).isDisabled(), true); resume();
  await page.getByRole("heading", { name: "Assistance request received" }).waitFor(); const submissions = calls.filter(call => call.endpoint === "/public/sell-assistance"); assert.equal(submissions.length, 1); assert.equal(submissions[0].body.includes(Buffer.from('"contactName":"Ada Okafor"')), true); assert.equal(submissions[0].body.includes(Buffer.from('"facilities":["CCTV"]')), true);
  failures.set("/public/sell-assistance", { status: 503, code: "SELL_ASSISTANCE_UNAVAILABLE", message: "Your assistance request could not be submitted. Please try again." });
  await page.goto(origin + "/sell/assistance"); await page.getByLabel(/2\. Preferred Contact Method/).selectOption("Email"); await page.getByLabel(/4\. What Location/).fill("Keep this location"); await page.getByLabel(/5\. What type of property/).selectOption("Commercial"); await page.getByLabel(/13\. How much/).fill("75000000"); await page.getByRole("button", { name: "Submit", exact: true }).click(); await page.getByText("Your assistance request could not be submitted").waitFor(); assert.equal(await page.getByLabel(/4\. What Location/).inputValue(), "Keep this location"); failures.delete("/public/sell-assistance");
  for (const width of [1440,1280,1024,768,430,390,360,320]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(origin + "/sell/assistance"); await page.getByRole("heading", { name: "Tell us about your property" }).waitFor(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `assistance overflow ${width}`);
    const columns = page.locator(".sell-assistance-columns"); assert.equal(await columns.evaluate(element => getComputedStyle(element).display), width <= 800 ? "block" : "grid");
    if (width <= 700) { await page.getByRole("button", { name: "Toggle navigation" }).click(); await navSell().click(); await prompt.waitFor(); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `prompt overflow ${width}`); if (width === 390) await screenshot("sell-decision-390"); await prompt.getByRole("button", { name: "Close sell assistance prompt" }).click(); }
    if (width === 1440 || width === 390) await screenshot(`sell-assistance-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(origin + "/buy"); await page.locator(".public-account-trigger").click(); await page.locator(".public-account-dropdown").getByRole("link", { name: "List Property" }).click(); await page.waitForURL("**/dashboard/listings/new"); assert.equal(await prompt.count(), 0);
  assert.equal(calls.some(call => call.method !== "GET" && /purchase|payment|checkout|referral|saved-properties|inquiries/.test(call.endpoint)), false);
  passed.push("Every public desktop/mobile Sell navigation click opens a non-persisted accessible decision prompt; No preserves the existing Sell route, Yes opens assistance, and dashboard List Property remains direct");
  passed.push("Sell Assistance validates conditional contact/document fields, private files, pending/success/failure states and responsive layouts at eight widths without listing or transaction side effects");
}
