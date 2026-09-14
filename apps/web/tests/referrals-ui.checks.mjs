import assert from "node:assert/strict";
import { runIfMain } from "./run-ui-suite.mjs";
runIfMain(import.meta.url, "referrals");

export const referralsState = { links: [], next: 2 };
const page = () => ({
  program: { commissionRateBasisPoints: 200 },
  summary: {
    availableBalance: 0,
    totalEarnings: 0,
    referrals: 0,
    propertiesSold: 0,
  },
  items: [],
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
});
export function referralsResponse(
  url,
  method,
  body,
  listings = [],
  webOrigin = url.origin,
) {
  if (method === "GET") return page();
  assert.deepEqual(
    Object.keys(body).sort(),
    body.type === "PROPERTY" ? ["listingId", "type"] : ["type"],
  );
  let item =
    body.type === "PROPERTY"
      ? referralsState.links.find(
          (value) =>
            value.referralType === "PROPERTY" &&
            value.listingId === body.listingId,
        )
      : referralsState.links.find((value) => value.referralType === "SELLER");
  if (!item) {
    const listing = listings.find((value) => value.id === body.listingId);
    if (body.type === "PROPERTY")
      assert(listing, "Property referral must use an owned listing");
    const id = `REF-N4K7P${referralsState.next++}`;
    item = {
      id,
      referralType: body.type,
      listingId: body.listingId ?? null,
      propertyCode: listing?.listing_code ?? null,
    };
    referralsState.links.unshift(item);
  }
  return {
    id: item.id,
    referralType: item.referralType,
    propertyCode: item.propertyCode,
    referralUrl:
      item.referralType === "PROPERTY"
        ? `${webOrigin}/properties/${item.propertyCode}?ref=${item.id}`
        : `${webOrigin}/register?ref=${item.id}`,
  };
}

export async function checkReferrals({
  page: browserPage,
  origin,
  failures,
  screenshot,
  passed,
  pauseRequest,
  resume,
  toast,
  context,
}) {
  const endpoint = "/dashboard/referrals",
    ready = () =>
      browserPage
        .getByRole("heading", { name: "Earn with Beryl Shelter", exact: true })
        .waitFor();
  const open = async () => {
    await browserPage.goto(origin + "/dashboard/referrals");
    await ready();
    await browserPage.evaluate(() => document.fonts.ready);
  };
  for (const width of [1440, 1280, 1024, 768, 390, 320]) {
    await browserPage.setViewportSize({ width, height: 900 });
    referralsState.links = [];
    await open();
    assert.equal(await browserPage.locator(".referral-kpi").count(), 4);
    assert.deepEqual(
      await browserPage.locator(".referral-kpi p").allTextContents(),
      ["₦0.00", "₦0.00", "0", "0"],
    );
    assert.deepEqual(
      await browserPage.locator(".referral-flow-step h3").allTextContents(),
      ["Send Invitation", "Registration and Purchase", "Referral Reward"],
    );
    assert.deepEqual(
      await browserPage.locator(".referrals-table th").allTextContents(),
      [
        "Id",
        "Budget",
        "Buyer Entity Type",
        "Ownership Type",
        "Contact Method",
        "Property Code",
        "Earnings",
        "Status",
      ],
    );
    await browserPage
      .getByText("No Referrals Found", { exact: true })
      .waitFor();
    assert.equal(
      await browserPage
        .locator('.dashboard-navigation [aria-current="page"]')
        .innerText(),
      "Referrals",
    );
    assert.equal(
      await browserPage.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `Referrals overflow at ${width}`,
    );
    await screenshot(`referrals-empty-${width}`);
  }
  passed.push(
    "Reference referral flow, two actions, four honest zero KPIs, exact table and responsive empty state at 1440/1280/1024/768/390/320px",
  );
  await browserPage.setViewportSize({ width: 1440, height: 900 });
  await open();
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin,
  });
  await browserPage
    .getByRole("button", { name: "Refer a Friend to Sell", exact: true })
    .click();
  await toast("Referral link copied to clipboard");
  assert.match(
    await browserPage.evaluate(() => navigator.clipboard.readText()),
    /\/register\?ref=REF-[A-HJ-NP-Z2-9]{6}$/,
  );
  await browserPage.getByText("No Referrals Found", { exact: true }).waitFor();
  assert.equal(
    await browserPage
      .locator('.referral-kpi[aria-label="Referrals"] p')
      .innerText(),
    "0",
  );
  assert.deepEqual(
    await browserPage.locator(".referral-kpi p").allTextContents(),
    ["₦0.00", "₦0.00", "0", "0"],
  );
  await browserPage
    .getByRole("button", { name: "Refer a Friend to Sell", exact: true })
    .click();
  await toast("Referral link copied to clipboard");
  assert.equal(referralsState.links.length, 1);
  await browserPage
    .getByRole("link", { name: "View Properties", exact: true })
    .click();
  await browserPage.waitForURL("**/dashboard/listings");
  passed.push(
    "Seller link creation is server-shaped, copyable and idempotent; no purchase, balance or earnings are invented; View Properties uses the existing Listings route",
  );
  referralsState.links = [];
  const observed = pauseRequest(endpoint);
  await browserPage.goto(origin + "/dashboard/referrals");
  await observed;
  await browserPage.locator(".brand-loader").waitFor();
  assert.equal(
    await browserPage.locator(".referrals-table,.referral-kpi").count(),
    0,
  );
  resume();
  await ready();
  failures.set(endpoint, {
    status: 503,
    code: "REFERRALS_UNAVAILABLE",
    message: "Referrals are temporarily unavailable. Please try again.",
  });
  await browserPage.goto(origin + "/dashboard/referrals");
  await toast("Referrals are temporarily unavailable. Please try again.");
  assert.equal(await browserPage.locator(".referrals-table").count(), 0);
  failures.delete(endpoint);
  await browserPage
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await ready();
  failures.set(endpoint, {
    status: 401,
    code: "SESSION_EXPIRED",
    message: "Please log in again.",
  });
  await browserPage.goto(origin + "/dashboard/referrals");
  await browserPage.waitForURL("**/login");
  failures.delete(endpoint);
  passed.push(
    "Referral loading hides stale values; failures offer a working retry; expired sessions return to Login",
  );
}
