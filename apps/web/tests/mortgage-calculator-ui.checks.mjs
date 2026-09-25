import assert from "node:assert/strict";
import { runIfMain } from "./run-ui-suite.mjs";

runIfMain(import.meta.url,"mortgage-calculator");

export async function checkMortgageCalculator({page,origin,calls,screenshot,passed}) {
  await page.goto(origin+"/mortgage-calculator");
  await page.getByRole("heading",{name:"Estimate how much house you can afford"}).waitFor();
  assert.equal(await page.getByLabel("Mortgage calculation results").getByText("₦0.00").count(),3);
  await page.getByRole("button",{name:"Calculate"}).click();
  await page.getByText("Enter a valid Home Purchase Price greater than zero.").waitFor();
  assert.equal(await page.getByText("Enter a valid non-negative Down Payment.").count(),1);
  assert.equal(await page.getByText("Select a valid Loan Term.").count(),1);
  assert.equal(await page.getByText("Enter an Interest Rate from 0 to 100%.").count(),1);

  await page.getByLabel(/Home Purchase Price/).fill("50000000");
  assert.equal(await page.getByLabel(/Home Purchase Price/).inputValue(),"50,000,000");
  await page.getByLabel(/Down Payment/).fill("60000000");
  assert.equal(await page.getByLabel(/Down Payment/).inputValue(),"60,000,000");
  await page.getByLabel(/Loan Term/).selectOption("20");
  await page.getByLabel(/Interest Rate/).fill("12");
  await page.getByRole("button",{name:"Calculate"}).click();
  await page.getByText("Down Payment cannot exceed Home Purchase Price.").waitFor();
  await page.getByLabel(/Down Payment/).fill("10000000");
  assert.equal(await page.locator(".mortgage-percentage").innerText(),"20.00 %");
  const callsBefore=calls.length;await page.getByRole("button",{name:"Calculate"}).click();
  await page.getByText("₦440,434.45").waitFor();
  assert.equal(await page.getByText("₦105,704,268.82").count(),1);
  assert.equal(await page.getByText("₦65,704,268.82").count(),1);
  assert.equal(calls.length,callsBefore,"Calculation must not make a network request");

  await page.getByLabel(/Loan Term/).selectOption("10");await page.getByLabel(/Interest Rate/).fill("0");await page.getByRole("button",{name:"Calculate"}).click();
  await page.getByText("₦333,333.33").waitFor();assert.equal(await page.getByText("₦40,000,000.00").count(),1);assert.equal(await page.getByText("₦0.00").count(),1);
  await page.getByRole("button",{name:"Reset"}).click();assert.equal(await page.getByLabel(/Home Purchase Price/).inputValue(),"");assert.equal(await page.locator(".mortgage-percentage").innerText(),"0.00 %");assert.equal(await page.getByLabel("Mortgage calculation results").getByText("₦0.00").count(),3);

  await page.goto(origin+"/mortgage-calculator?code=RES-ABC234");await page.getByLabel(/Home Purchase Price/).waitFor();await page.waitForFunction(()=>document.querySelector("#purchase-price")?.value==="85,000,000.00");
  await page.getByRole("button",{name:"Reset"}).click();assert.equal(await page.getByLabel(/Home Purchase Price/).inputValue(),"85,000,000.00");
  await page.goto(origin+"/mortgage-calculator?code=UNLISTED-404");await page.getByLabel(/Home Purchase Price/).waitFor();await page.waitForTimeout(100);assert.equal(await page.getByLabel(/Home Purchase Price/).inputValue(),"");

  await page.goto(origin+"/mortgage-calculator");await page.locator(".public-account-trigger").click();assert.equal(await page.locator(".public-account-dropdown").getByRole("link",{name:"Mortgage Calculator"}).getAttribute("href"),"/mortgage-calculator");assert.equal(await page.locator(".public-account-dropdown").getByRole("link",{name:"Saved Property"}).getAttribute("href"),"/saved-properties");assert.equal(await page.locator(".public-account-dropdown").getByRole("link",{name:"Compare Property"}).getAttribute("href"),"/compare-properties");
  for(const width of [1440,1280,1024,768,430,390,360,320]){await page.setViewportSize({width,height:950});await page.goto(origin+"/mortgage-calculator");await page.getByRole("heading",{name:"Estimate how much house you can afford"}).waitFor();const overflow=await page.evaluate(()=>[...document.querySelectorAll("body *")].flatMap(element=>{const box=element.getBoundingClientRect();return box.right>innerWidth+1||box.left<-1?[`${element.tagName}.${element.className}`,box.left,box.right]:[]}));assert.deepEqual(overflow,[],`mortgage overflow ${width}`);const result=await page.locator(".mortgage-result-card").boundingBox(),form=await page.locator(".mortgage-form-card").boundingBox();if(width<=900)assert.equal(result.y<form.y,true,`result before form at ${width}`);else assert.equal(Math.abs(result.y-form.y)<10,true,`desktop alignment at ${width}`);if(width===1440||width===390)await screenshot(`mortgage-calculator-${width}`)}
  assert.equal(calls.some(call=>call.endpoint.includes("mortgage")||/payment|checkout|purchase|application|lender/i.test(call.endpoint)),false);
  passed.push("Mortgage Calculator validates inputs, computes positive and zero-interest amortization from the post-down-payment principal, resets locally, and makes no calculation request");
  passed.push("Optional LISTED public-code prefill is safe, the account link is active, and desktop/mobile layouts have no global overflow at eight widths");
}
