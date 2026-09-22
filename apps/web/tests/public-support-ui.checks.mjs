import assert from "node:assert/strict";
import { runIfMain } from "./run-ui-suite.mjs";

runIfMain(import.meta.url, "public-support");
export const supportState = { submissions: [] };

export async function checkPublicSupport({
  page,
  origin,
  calls,
  failures,
  screenshot,
  passed,
  pauseRequest,
  resume,
}) {
  for (const width of [1440, 1280, 768, 430, 390, 360]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(origin + "/support");
    await page
      .getByRole("heading", {
        name: "Welcome to Beryl Shelter Nigeria Limited Support",
      })
      .waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(
      await page.locator(".public-nav a.active").innerText(),
      "Support",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `Support overflow at ${width}`,
    );
    assert.equal(
      await page.evaluate(
        () =>
          Math.abs(
            document.querySelector(".support-hero").getBoundingClientRect()
              .top -
              document.querySelector(".public-header").getBoundingClientRect()
                .bottom,
          ) < 1,
      ),
      true,
    );
    assert.equal(await page.locator(".support-faq-item").count(), 5);
    assert.equal(
      await page.locator(".support-contact a[href^='mailto:']").count(),
      1,
    );
    assert.equal(
      await page.locator(".support-contact a[href^='tel:']").count(),
      1,
    );
    assert.deepEqual(await page.locator(".support-report select option").allTextContents(),["Select an option","Property","Agent"]);
    assert.equal(await page.locator(".support-report select").inputValue(), "");
    assert.equal(await page.getByRole("searchbox",{name:"Search support FAQs"}).evaluate(element=>getComputedStyle(element).borderRadius),"6px");
    assert.equal(await page.getByRole("link",{name:"Contact Us"}).evaluate(element=>getComputedStyle(element).borderRadius),"6px");
    assert.equal(await page.locator(".support-report form>button").evaluate(element=>getComputedStyle(element).borderRadius),"6px");
    assert.equal(await page.locator(".support-faq-item svg.support-faq-chevron").count(),5);
    assert.equal(await page.locator(".support-location-icon").count(),1);
    await page.locator(".support-report select").selectOption("PROPERTY");
    assert.equal(await page.getByPlaceholder("Enter Property Code").count(),1);
    assert.equal(await page.getByPlaceholder("Enter Agent ID").count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Property form overflow at ${width}`);
    await page.locator(".support-report select").selectOption("AGENT");
    assert.equal(await page.getByPlaceholder("Enter Agent ID").count(),1);
    assert.equal(await page.getByPlaceholder("Enter Property Code").count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Agent form overflow at ${width}`);
    assert.equal(
      (await page.request.get(`${origin}/support/support-bg.svg`)).ok(),
      true,
    );
    assert.equal(
      await page
        .locator(".support-report input[name=agentName]")
        .getAttribute("required"),
      null,
    );
    if (width === 1440 || width === 390)
      await screenshot(`public-support-${width}`);
  }
  const first = page.locator(".support-faq-item").first();
  assert.equal(
    await first.locator("button").getAttribute("aria-expanded"),
    "true",
  );
  await page.waitForFunction(()=>getComputedStyle(document.querySelector(".support-faq-item:first-child .support-faq-chevron")).transform.includes("-1"));
  await first.locator("button").click();
  assert.equal(
    await first.locator("button").getAttribute("aria-expanded"),
    "false",
  );
  await page.waitForFunction(()=>getComputedStyle(document.querySelector(".support-faq-item:first-child .support-faq-chevron")).transform==="none");
  await first.locator("button").focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await first.locator("button").getAttribute("aria-expanded"),
    "true",
  );
  await page.locator(".support-faq-item").nth(2).locator("button").click();
  assert.equal(
    await page
      .locator(".support-faq-item")
      .nth(2)
      .locator("button")
      .getAttribute("aria-expanded"),
    "true",
  );
  await page
    .getByRole("searchbox", { name: "Search support FAQs" })
    .fill("verification");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  assert.equal(await page.locator(".support-faq-item").count(), 1);
  await page
    .getByRole("searchbox", { name: "Search support FAQs" })
    .fill("unlikely phrase");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByText("No matching FAQ found.", { exact: false }).waitFor();
  await page.getByRole("searchbox", { name: "Search support FAQs" }).fill("");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const form = page.locator(".support-report form");
  await form.getByRole("button", { name: "Submit Report" }).click();
  assert.equal(supportState.submissions.length, 0);
  await form.getByPlaceholder("Enter Agent ID").fill("AG-101");
  await form
    .getByPlaceholder("Describe what happened")
    .fill("A suspicious agent asked for an advance fee.");
  failures.set("/public/support/reports", {
    status: 503,
    code: "SUPPORT_UNAVAILABLE",
  });
  await form.getByRole("button", { name: "Submit Report" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "could not be submitted" })
    .waitFor();
  assert.equal(
    await form.getByPlaceholder("Enter Agent ID").inputValue(),
    "AG-101",
  );
  assert.equal(supportState.submissions.length, 0);
  failures.delete("/public/support/reports");
  const paused = pauseRequest("/public/support/reports");
  await form.getByRole("button", { name: "Submit Report" }).click();
  await paused;
  assert.equal(
    await form.getByRole("button", { name: "Submitting…" }).isDisabled(),
    true,
  );
  assert.equal(supportState.submissions.length, 0);
  resume();
  await page
    .getByRole("status")
    .filter({ hasText: "submitted successfully" })
    .waitFor();
  assert.equal(supportState.submissions.length, 1);
  assert.deepEqual(supportState.submissions[0], {
    reportType: "AGENT",
    agentId: "AG-101",
    agentName: "",
    reason: "A suspicious agent asked for an advance fee.",
  });
  assert.equal(await form.locator("select[name=reportType]").inputValue(), "");
  assert.equal(
    calls.filter(
      (call) =>
        call.endpoint === "/public/support/reports" && call.method === "POST",
    ).length,
    2,
  );
  passed.push(
    "Support renders at six widths with active navigation, background, FAQ search/accordion, contact details, and no overflow",
  );
  passed.push(
    "Agent public report validates required fields, preserves input on failure, prevents duplicate pending writes, and clears only after success",
  );
  await form.locator("select[name=reportType]").selectOption("PROPERTY");
  await form.getByPlaceholder("Enter Property Code").fill("RES-101");
  await form.getByPlaceholder("Enter name (optional)").fill("Example home");
  await form.getByPlaceholder("Describe what happened").fill("An old advert has misleading details.");
  await form.locator("select[name=reportType]").selectOption("AGENT");
  assert.equal(await form.getByPlaceholder("Enter Property Code").count(),0);
  assert.equal(await form.getByPlaceholder("Enter Agent ID").inputValue(),"");
  await form.getByPlaceholder("Enter Agent ID").fill("AG-202");
  await form.locator("select[name=reportType]").selectOption("PROPERTY");
  assert.equal(await form.getByPlaceholder("Enter Agent ID").count(),0);
  assert.equal(await form.getByPlaceholder("Enter Property Code").inputValue(),"");
  await form.getByPlaceholder("Enter Property Code").fill("OLD-UNLISTED");
  failures.set("/public/support/reports",{status:503,code:"SUPPORT_UNAVAILABLE"});
  await form.getByRole("button",{name:"Submit Report"}).click();
  await page.getByRole("alert").filter({hasText:"could not be submitted"}).waitFor();
  assert.equal(await form.getByPlaceholder("Enter Property Code").inputValue(),"OLD-UNLISTED");
  failures.delete("/public/support/reports");
  await form.getByRole("button",{name:"Submit Report"}).click();
  await page.getByRole("status").filter({hasText:"submitted successfully"}).waitFor();
  assert.deepEqual(supportState.submissions.at(-1),{reportType:"PROPERTY",propertyCode:"OLD-UNLISTED",propertyName:"",reason:"An old advert has misleading details."});
  assert.equal(supportState.submissions.length,2);
  passed.push("Property reports submit their own fields; switching clears stale Agent/Property values while retaining the shared reason");
}
