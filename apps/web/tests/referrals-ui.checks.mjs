import assert from "node:assert/strict";
import { runIfMain } from "./run-ui-suite.mjs";
runIfMain(import.meta.url, "referrals");

export const referralsState = { links: [], next: 2, history: [], summary: null };
const page = (requestedPage = 1) => ({
  program: { commissionRateBasisPoints: 200 },
  summary: referralsState.summary ?? {
    availableBalance: 0,
    totalEarnings: 0,
    referrals: 0,
    propertiesSold: 0,
  },
  items: referralsState.history.slice((requestedPage-1)*10,requestedPage*10),
  page: requestedPage,
  pageSize: 10,
  total: referralsState.history.length,
  totalPages: Math.ceil(referralsState.history.length/10),
});
export function referralsResponse(
  url,
  method,
  body,
  listings = [],
  webOrigin = url.origin,
) {
  if (method === "GET") return page(Number(url.searchParams.get("page")||1));
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
        .getByRole("heading", { name: "Earn with Beryl Prestige Livings", exact: true })
        .waitFor();
  const open = async () => {
    await browserPage.goto(origin + "/dashboard/referrals");
    await ready();
    await browserPage.evaluate(() => document.fonts.ready);
  };
  for (const width of [1440, 768, 390, 320]) {
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
    assert.equal(await browserPage.locator(".referrals-table").count(),0);
    await browserPage.getByRole("heading", { name: "No referrals yet" }).waitFor();
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
    if(width<=768){const positions=await browserPage.evaluate(()=>Object.fromEntries(["invite","kpis","earn","history"].map(name=>[name,document.querySelector(`.referrals-${name},.referral-${name}`)?.getBoundingClientRect().top])));assert(positions.invite<positions.kpis&&positions.kpis<positions.earn&&positions.earn<positions.history);}
    await screenshot(`referrals-empty-${width}`);
  }
  passed.push(
    "Reference referral flow, two actions, four honest zero KPIs and responsive empty state match the supplied hierarchy at 1440/768/390/320px",
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
  await browserPage.getByRole("heading", { name: "No referrals yet" }).waitFor();
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
  await browserPage.waitForURL("**/buy");
  passed.push(
    "Seller link creation is server-shaped, copyable and idempotent; no purchase, balance or earnings are invented; View Properties uses public Buy",
  );
  referralsState.history=Array.from({length:12},(_,index)=>({id:`COM-REAL${String(index+1).padStart(2,"0")}`,referralType:index%2?"SELLER":"PROPERTY",saleAmount:50000000+index*1000000,propertyCode:`RES-TEST${index}`,earnings:1000000+index*20000,status:"COMPLETED",completedAt:`2026-09-${String(index+1).padStart(2,"0")}T12:00:00.000Z`}));
  referralsState.summary={availableBalance:1000000,totalEarnings:1000000,referrals:12,propertiesSold:1};
  await open(); assert.deepEqual(await browserPage.locator(".referrals-table th").allTextContents(),["Reference","Referral Type","Completed Sale","Property Code","Earnings","Status","Completed"]); assert.equal(await browserPage.locator(".referrals-table tbody tr").count(),10); await browserPage.getByText("Showing 1-10 of 12").waitFor();
  await browserPage.getByRole("button",{name:/Next/}).click(); await browserPage.getByText("COM-REAL11").waitFor(); await browserPage.getByText("Showing 11-12 of 12").waitFor();
  for(const width of [390,320]){await browserPage.setViewportSize({width,height:900});await browserPage.goto(origin+"/dashboard/referrals");await browserPage.getByText("COM-REAL01").waitFor();assert.equal(await browserPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await browserPage.locator(".referrals-table-scroll").evaluate(element=>element.scrollWidth>element.clientWidth),true);if(width===390)await screenshot("referrals-populated-390");}
  referralsState.history=[];referralsState.summary=null;
  passed.push("Populated history renders only API-shaped values and bounded server pagination; unavailable designed fields remain omitted rather than fabricated");
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
