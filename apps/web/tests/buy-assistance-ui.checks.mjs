import assert from "node:assert/strict";
import { runIfMain } from "./run-ui-suite.mjs";

runIfMain(import.meta.url, "buy-assistance");

export async function checkBuyAssistance({ page, origin, calls, failures, screenshot, passed, pauseRequest, resume }) {
  const navBuy = () => page.getByRole("navigation", { name: "Public navigation" }).getByRole("link", { name: "Buy", exact: true });
  const prompt = page.getByRole("dialog", { name: "Do you need Assistance?" });
  await page.goto(origin + "/about"); await navBuy().click(); await prompt.waitFor();
  const size = await prompt.boundingBox(); assert(size && size.width <= 520 && size.height < 260); await screenshot("buy-decision-1440");
  await prompt.getByRole("button", { name: "Close buy assistance prompt" }).click(); assert.equal(await prompt.count(), 0); assert.equal(await navBuy().evaluate(element => element === document.activeElement), true);
  await navBuy().click(); await page.keyboard.press("Escape"); assert.equal(await prompt.count(), 0);
  await navBuy().click(); await prompt.getByRole("button", { name: "No", exact: true }).click(); await page.waitForURL("**/buy");
  await navBuy().click(); await prompt.getByRole("button", { name: "Yes", exact: true }).click(); await page.waitForURL("**/buy/assistance");
  await page.getByRole("heading", { name: "What are your buy requirements" }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll("input")].some(input => input.value === "Ada Okafor"));
  assert.equal(await page.getByLabel(/1\. Contact Name/).inputValue(), "Ada Okafor"); assert.equal(await page.locator(".site-footer").count(), 1);
  await page.getByRole("button", { name: "Submit", exact: true }).click(); assert.equal(await page.getByRole("alert").count() >= 4, true);
  await page.getByLabel(/2\. Preferred Contact Method/).selectOption("Email"); assert.equal(await page.getByLabel("Contact Email *").inputValue(), "ada@example.test");
  await page.getByLabel(/3\. What type of property/).selectOption("Residential"); await page.getByLabel(/4\. Property Subtype/).selectOption("Bungalow");
  await page.getByLabel(/5\. How many bedrooms/).selectOption("7+"); await page.getByLabel(/6\. How many bathrooms/).selectOption("3");
  await page.getByLabel(/7\. What Locality/).fill("Lekki"); await page.getByLabel(/8\. What State/).selectOption("Federal Capital Territory (FCT)"); await page.getByLabel(/9\. What City/).fill("Abuja");
  assert.equal(await page.getByLabel(/8\. What State/).locator("option").count(), 38); await page.getByLabel("CCTV").check(); await page.getByLabel("Garden").check();
  await page.getByLabel(/11\. What is your budget/).fill("85000000"); assert.equal(await page.getByLabel(/11\. What is your budget/).inputValue(), "85,000,000");
  await page.getByLabel(/12\. How are you paying/).selectOption("Mortgage"); await page.getByLabel(/13\. How soon/).selectOption("Within 3 Months");
  await page.getByLabel(/14\. Buy Mandate/).setInputFiles({ name: "mandate.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
  await page.getByLabel(/15\. Your likely transferable giftings/).fill("Flexible completion date");
  const paused = pauseRequest("/public/buy-assistance"); await page.getByRole("button", { name: "Submit", exact: true }).click(); await paused; assert.equal(await page.getByRole("button", { name: "Submitting…" }).isDisabled(), true); resume();
  await page.getByRole("heading", { name: "Buying assistance request received" }).waitFor(); const submissions = calls.filter(call => call.endpoint === "/public/buy-assistance"); assert.equal(submissions.length, 1); assert.equal(submissions[0].body.includes(Buffer.from('"budget":"85000000"')), true); assert.equal(submissions[0].body.includes(Buffer.from('"facilities":["CCTV","Garden"]')), true);
  failures.set("/public/buy-assistance", { status: 503, code: "BUY_ASSISTANCE_UNAVAILABLE", message: "Your buying assistance request could not be submitted. Please try again." });
  await page.goto(origin + "/buy/assistance"); await page.getByLabel(/2\. Preferred Contact Method/).selectOption("Email"); await page.getByLabel(/3\. What type of property/).selectOption("Commercial"); assert.equal(await page.getByLabel(/4\. Property Subtype/).isDisabled(), true); assert.equal(await page.getByLabel(/5\. How many bedrooms/).isDisabled(), true);
  await page.getByLabel(/8\. What State/).selectOption("Lagos"); await page.getByLabel(/11\. What is your budget/).fill("50000000"); await page.getByRole("button", { name: "Submit", exact: true }).click(); await page.getByText("Your buying assistance request could not be submitted").waitFor(); assert.equal(await page.getByLabel(/11\. What is your budget/).inputValue(), "50,000,000"); failures.delete("/public/buy-assistance");
  for (const width of [1440,1280,1024,768,430,390,360,320]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(origin + "/buy/assistance"); await page.getByRole("heading", { name: "What are your buy requirements" }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Buy Assistance overflow ${width}`);
    assert.equal(await page.locator(".buy-assistance-columns").evaluate(element => getComputedStyle(element).display), width <= 800 ? "block" : "grid");
    if (width <= 700) { await page.getByRole("button", { name: "Toggle navigation" }).click(); await navBuy().click(); await prompt.waitFor(); const mobileSize = await prompt.boundingBox(); assert(mobileSize && mobileSize.width <= width - 32 + 1); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); if (width === 390) await screenshot("buy-decision-390"); await prompt.getByRole("button", { name: "Close buy assistance prompt" }).click(); }
    if (width === 1440 || width === 390) await screenshot(`buy-assistance-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(origin + "/"); await page.getByRole("link", { name: /Click here to refer someone to buy/i }).click(); await page.waitForURL("**/buy"); assert.equal(await prompt.count(), 0);
  assert.equal(calls.some(call => call.method !== "GET" && /purchase|payment|checkout|mortgage|referral|listings|saved-properties|inquiries|sell-assistance/.test(call.endpoint)), false);
  passed.push("Public Buy navigation always opens the shared compact non-persisted decision; No opens /buy, Yes opens /buy/assistance, and non-navbar Buy links remain direct");
  passed.push("Buy Assistance validates conditional and taxonomy fields, private PDF, pending/success/failure states, shared footer, and eight widths without transaction side effects");
}
