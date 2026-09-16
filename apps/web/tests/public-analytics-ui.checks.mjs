import assert from "node:assert/strict";
import { runIfMain } from "./run-ui-suite.mjs";

runIfMain(import.meta.url,"public-analytics");
export const publicAnalyticsState={zero:false};

export async function checkPublicAnalytics({page,origin,calls,failures,screenshot,passed}){
  const widths=[1440,1280,768,430,390,360];
  for(const width of widths){
    await page.setViewportSize({width,height:950});
    await page.goto(origin+"/analytics");
    await page.getByRole("heading",{name:"Average Property Price Change Overtime"}).waitFor();
    await page.getByRole("figure",{name:/Monthly average listed property price/}).waitFor();
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Analytics overflow at ${width}`);
    assert.equal(await page.locator('.public-nav a[aria-current="page"],.public-nav a.active').filter({hasText:"Analytics & Insights"}).count(),1);
    const layout=await page.evaluate(()=>{const price=document.querySelector(".public-price-card").getBoundingClientRect();const summary=document.querySelector(".public-summary-card").getBoundingClientRect();return{summaryRight:summary.left>=price.right,summaryBelow:summary.top>=price.bottom,footer:!!document.querySelector(".site-footer")&&getComputedStyle(document.querySelector(".site-footer")).display!=="none",visibleMonths:[...document.querySelectorAll(".public-chart-months span")].filter(element=>getComputedStyle(element).display!=="none").length};});
    assert(width>900?layout.summaryRight:layout.summaryBelow);
    assert.equal(layout.footer,width>900);
    assert.equal(layout.visibleMonths,width>900?12:7);
    assert.equal(calls.some(call=>call.endpoint==="/dashboard/analytics"),false,"Public Analytics must not request private Analytics data");
    assert.equal(calls.some(call=>call.endpoint==="/public/property-searches"),false,"Analytics page views must not record searches");
    assert.equal(await page.locator(".public-donut strong").innerText(),"25%");
    assert.equal(await page.locator(".public-donut span").innerText(),"Residential properties");
    if(width===1440||width===390)await screenshot(`public-analytics-${width}`);
  }
  const monthlyPath=await page.locator(".public-mobile-line path").getAttribute("d");
  await page.getByRole("button",{name:"Annually"}).click();
  assert.equal(await page.getByRole("button",{name:"Annually"}).getAttribute("aria-pressed"),"true");
  await page.getByRole("figure",{name:/Annual average listed property price/}).waitFor();
  assert.notEqual(await page.locator(".public-mobile-line path").getAttribute("d"),monthlyPath);
  assert.deepEqual(await page.locator(".public-chart-months span").allTextContents(),["2025","2026"]);
  await page.getByRole("button",{name:"Monthly"}).click();
  assert.equal(await page.getByRole("button",{name:"Monthly"}).getAttribute("aria-pressed"),"true");
  await page.getByRole("figure",{name:/Monthly average listed property price/}).waitFor();
  failures.set("/public/analytics",{status:503,code:"ANALYTICS_UNAVAILABLE"});
  await page.reload();await page.locator(".public-analytics-state[role=alert]").waitFor();assert.equal(await page.locator(".public-donut strong").count(),0);assert.equal(await page.locator(".public-chart-plot path").count(),0);
  failures.delete("/public/analytics");await page.getByRole("button",{name:"Try again"}).click();await page.getByRole("figure",{name:/Monthly average listed property price/}).waitFor();
  publicAnalyticsState.zero=true;await page.reload();await page.getByText("No listed property prices for this period.").waitFor();assert.equal(await page.locator(".public-donut strong").innerText(),"0%");assert.equal(await page.locator(".public-chart-plot path").count(),0);publicAnalyticsState.zero=false;
  passed.push("Public Analytics uses real API-shaped data at 1440/1280/768/430/390/360, with no overflow or private Analytics requests");
  passed.push("Monthly and Annually request distinct aggregates; failure hides figures and retry restores them; zero data is honest");
}
