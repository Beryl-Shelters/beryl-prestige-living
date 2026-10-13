import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.AUTH_UI_ORIGIN || "http://127.0.0.1:3000";
assert(["127.0.0.1", "localhost"].includes(new URL(origin).hostname), "Local server required");

const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true });

const hydrationErrors = [];

function monitorHydration(page, label) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/hydration|did not match|server rendered|Minified React error #(418|423)/i.test(text)) {
      hydrationErrors.push(`${label}: ${text}`);
    }
  });
}

async function waitForPreference(page, preference, resolvedTheme) {
  const label = `${preference[0].toUpperCase()}${preference.slice(1)} theme`;
  await page.waitForFunction(
    ({ label, resolvedTheme }) =>
      document.querySelector(`[aria-label="${label}"]`)?.getAttribute("aria-checked") === "true" &&
      document.documentElement.dataset.theme === resolvedTheme,
    { label, resolvedTheme },
  );
}

async function inspect({ colorScheme, stored }) {
  const context = await browser.newContext({ colorScheme, serviceWorkers: "block" });
  if (stored !== undefined) {
    await context.addInitScript((value) => localStorage.setItem("beryl_theme", value), stored);
  }
  const page = await context.newPage();
  monitorHydration(page, `fresh ${colorScheme}/${stored ?? "unset"}`);
  await page.goto(origin + "/");
  await page.getByRole("radiogroup", { name: "Theme preference" }).waitFor();
  const expectedPreference = stored ?? "light";
  const expectedTheme = expectedPreference === "system" ? colorScheme : expectedPreference;
  await waitForPreference(page, expectedPreference, expectedTheme);
  const result = await page.evaluate(() => ({
    stored: localStorage.getItem("beryl_theme"),
    theme: document.documentElement.getAttribute("data-theme"),
    colorScheme: document.documentElement.style.colorScheme,
  }));
  const selected = await page.getByRole("radio", { checked: true }).getAttribute("aria-label");
  await context.close();
  return { ...result, selected };
}

try {
  assert.deepEqual(await inspect({ colorScheme: "dark" }), {
    stored: null,
    theme: "light",
    colorScheme: "light",
    selected: "Light theme",
  });
  assert.deepEqual(await inspect({ colorScheme: "light" }), {
    stored: null,
    theme: "light",
    colorScheme: "light",
    selected: "Light theme",
  });
  assert.deepEqual(await inspect({ colorScheme: "dark", stored: "light" }), {
    stored: "light",
    theme: "light",
    colorScheme: "light",
    selected: "Light theme",
  });
  assert.deepEqual(await inspect({ colorScheme: "light", stored: "dark" }), {
    stored: "dark",
    theme: "dark",
    colorScheme: "dark",
    selected: "Dark theme",
  });
  assert.deepEqual(await inspect({ colorScheme: "dark", stored: "system" }), {
    stored: "system",
    theme: "dark",
    colorScheme: "dark",
    selected: "System theme",
  });
  assert.deepEqual(await inspect({ colorScheme: "light", stored: "system" }), {
    stored: "system",
    theme: "light",
    colorScheme: "light",
    selected: "System theme",
  });

  const context = await browser.newContext({ colorScheme: "light", serviceWorkers: "block" });
  const page = await context.newPage();
  monitorHydration(page, "same-tab and navigation");
  await page.goto(origin + "/");
  await page.getByRole("radio", { name: "Dark theme" }).click();
  await waitForPreference(page, "dark", "dark");
  await page.reload();
  assert.equal(await page.evaluate(() => localStorage.getItem("beryl_theme")), "dark");
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
  await page.getByRole("radio", { name: "System theme" }).click();
  await waitForPreference(page, "system", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await waitForPreference(page, "system", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await waitForPreference(page, "system", "light");
  await page.getByRole("radio", { name: "Light theme" }).click();
  await waitForPreference(page, "light", "light");
  await page.goto(origin + "/about");
  await waitForPreference(page, "light", "light");
  await context.close();

  const syncContext = await browser.newContext({ colorScheme: "light", serviceWorkers: "block" });
  const firstTab = await syncContext.newPage();
  const secondTab = await syncContext.newPage();
  monitorHydration(firstTab, "cross-tab first");
  monitorHydration(secondTab, "cross-tab second");
  await Promise.all([firstTab.goto(origin + "/"), secondTab.goto(origin + "/")]);
  await firstTab.getByRole("radio", { name: "Dark theme" }).click();
  await Promise.all([
    waitForPreference(firstTab, "dark", "dark"),
    waitForPreference(secondTab, "dark", "dark"),
  ]);
  await secondTab.getByRole("radio", { name: "System theme" }).click();
  await Promise.all([
    waitForPreference(firstTab, "system", "light"),
    waitForPreference(secondTab, "system", "light"),
  ]);
  await secondTab.getByRole("radio", { name: "Light theme" }).click();
  await Promise.all([
    waitForPreference(firstTab, "light", "light"),
    waitForPreference(secondTab, "light", "light"),
  ]);
  await syncContext.close();

  const dashboardContext = await browser.newContext({ colorScheme: "dark", serviceWorkers: "block" });
  await dashboardContext.addInitScript(() => localStorage.setItem("beryl_theme", "dark"));
  const dashboardPage = await dashboardContext.newPage();
  monitorHydration(dashboardPage, "dashboard");
  await dashboardPage.route("**/api/v1/dashboard/overview", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      success: true,
      data: {
        customer: { id: "theme-test", first_name: "Theme", last_name: "Tester", account_type: "BUYER", profile_type: null, profile_image_url: null },
        summary: { total_investments: 0, properties_owned: 0, referral_earnings: 0, new_messages: 0 },
        revenue: { monthly: [], yearly: [] },
        recent_messages: [],
        recent_property_listings: [],
      },
    }),
  }));
  await dashboardPage.goto(origin + "/dashboard");
  await dashboardPage.getByRole("radiogroup", { name: "Theme preference" }).waitFor();
  await waitForPreference(dashboardPage, "dark", "dark");
  await dashboardPage.getByRole("radio", { name: "Light theme" }).click();
  await waitForPreference(dashboardPage, "light", "light");
  await dashboardContext.close();

  assert.deepEqual(hydrationErrors, []);
  console.log("Web theme defaults, persistence, navigation, cross-tab sync, dashboard controls, hydration and live System behavior passed");
} finally {
  await browser.close();
}
