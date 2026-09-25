import assert from "node:assert/strict";
import { runIfMain } from "./run-ui-suite.mjs";

runIfMain(import.meta.url, "saved-properties");

const fixture = [
  { code:"RES-SAVE01",title:"4 Bedroom Semi Detached Duplex",description:"Public description",propertyType:"Residential",propertySubtype:"Semi-Detached House",priceMinor:8500000000,state:"Lagos",city:"Ikeja",bedrooms:4,bathrooms:1,parkingSpaces:1,facilities:["Wi-Fi"],listedAt:"2026-09-24T00:00:00Z",images:["https://images.example.test/home.png"] },
  { code:"RES-SAVE02",title:"Garden Family Home",description:"Public description",propertyType:"Residential",propertySubtype:"Bungalow",priceMinor:6300000000,state:"Rivers",city:"Port Harcourt",bedrooms:3,bathrooms:2,parkingSpaces:2,facilities:["Garden"],listedAt:"2026-09-23T00:00:00Z",images:["https://images.example.test/home.png"] },
  { code:"RES-SAVE03",title:"Central Lagos Apartment",description:"Public description",propertyType:"Residential",propertySubtype:"Block of flats",priceMinor:4200000000,state:"Lagos",city:"Lekki",bedrooms:2,bathrooms:2,parkingSpaces:1,facilities:[],listedAt:"2026-09-22T00:00:00Z",images:[] },
  { code:"RES-SAVE04",title:"Abuja Courtyard Bungalow",description:"Public description",propertyType:"Residential",propertySubtype:"Bungalow",priceMinor:7100000000,state:"Abuja",city:"Maitama",bedrooms:5,bathrooms:4,parkingSpaces:3,facilities:["CCTV"],listedAt:"2026-09-21T00:00:00Z",images:["https://images.example.test/home.png"] },
];
export const savedPropertiesState = { items: structuredClone(fixture), nonListedCodes: new Set() };
export function resetSavedPropertiesState() { savedPropertiesState.items = structuredClone(fixture); savedPropertiesState.nonListedCodes.clear(); }

export function savedPropertiesResponse(url, method, body, availableProperties=[]) {
  if (url.pathname === "/api/v1/saved-properties/states") {
    const codes=(url.searchParams.get("codes")??"").split(",");
    return { status:200,data:{propertyCodes:savedPropertiesState.items.map(item=>item.code).filter(code=>codes.includes(code))} };
  }
  if (url.pathname === "/api/v1/saved-properties" && method === "POST") {
    const found=availableProperties.find(item=>item.code===body?.propertyCode);
    if(found&&!savedPropertiesState.items.some(item=>item.code===found.code))savedPropertiesState.items.unshift(found);
    return found?{status:201,data:{propertyCode:found.code,saved:true}}:{status:404,error:{code:"PROPERTY_NOT_AVAILABLE",message:"This property is not available to save."}};
  }
  if (url.pathname === "/api/v1/saved-properties/compare") {
    const codes=(url.searchParams.get("codes")??"").split(",");
    return {status:200,data:{items:codes.flatMap(code=>{const item=savedPropertiesState.items.find(property=>property.code===code);return item&&!savedPropertiesState.nonListedCodes.has(code)?[{...item,propertyStatus:"Available",unitSizeSqft:null,yearBuilt:code==="RES-SAVE03"?null:2021,minimumDownPaymentMinor:1000000000}]:[]})}};
  }
  if (url.pathname.startsWith("/api/v1/saved-properties/") && method === "DELETE") {
    const code=decodeURIComponent(url.pathname.split("/").at(-1));savedPropertiesState.items=savedPropertiesState.items.filter(item=>item.code!==code);
    return {status:200,data:{propertyCode:code,saved:false}};
  }
  const q=(url.searchParams.get("q")??"").toLowerCase();let items=savedPropertiesState.items.filter(item=>!q||[item.title,item.code,item.state,item.city].some(value=>value.toLowerCase().includes(q)));
  const page=Number(url.searchParams.get("page")??1),pageSize=Number(url.searchParams.get("pageSize")??12),total=items.length;
  items=items.slice((page-1)*pageSize,page*pageSize);return {status:200,data:{items,page,pageSize,total,totalPages:Math.ceil(total/pageSize)}};
}

export async function checkSavedProperties({page,origin,calls,failures,screenshot,passed}) {
  failures.set("/me",{status:401,code:"SESSION_EXPIRED",message:"Your session has expired. Please log in again."});
  await page.goto(origin+"/saved-properties");await page.waitForURL("**/login?next=%2Fsaved-properties");
  assert.equal(calls.filter(call=>call.endpoint==="/saved-properties").length,0);
  failures.delete("/me");

  const requestCount=()=>calls.filter(call=>call.endpoint==="/saved-properties"&&call.method==="GET").length;
  await page.goto(origin+"/saved-properties");await page.getByRole("heading",{name:"My Saved Properties"}).waitFor();
  await page.locator(".saved-property-card").first().waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator(".saved-property-card").count(),4);
  assert.equal(await page.locator(".saved-properties-grid").evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(" ").length),3);
  assert.equal(await page.getByLabel(/Remove .* from saved properties/).count(),4);
  assert.equal(await page.getByLabel(/Share /).count(),4);
  assert.equal(await page.getByText("₦85,000,000").count(),1);
  assert.equal(await page.locator(".site-footer").count(),1);
  await screenshot("saved-properties-1440");

  await page.getByPlaceholder("Search your saved properties").fill("Rivers");
  const beforeSearch=requestCount();await page.getByPlaceholder("Search your saved properties").press("Enter");
  await page.getByRole("heading",{name:"Garden Family Home"}).waitFor();assert.equal(await page.locator(".saved-property-card").count(),1);assert.equal(requestCount(),beforeSearch+1);
  await page.getByPlaceholder("Search your saved properties").fill("no-match");await page.getByPlaceholder("Search your saved properties").press("Enter");
  await page.getByText("No saved properties match your search.").waitFor();await page.getByRole("button",{name:"Clear search"}).click();await page.locator(".saved-property-card").first().waitFor();

  await page.context().grantPermissions(["clipboard-read","clipboard-write"],{origin});
  await page.evaluate(()=>Object.defineProperty(navigator,"share",{value:undefined,configurable:true}));
  await page.getByLabel("Share 4 Bedroom Semi Detached Duplex").click();await page.getByText("Property link copied.").waitFor();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),`${origin}/buy?code=RES-SAVE01`);
  const listingCount=()=>savedPropertiesState.items.length;const beforeRemove=listingCount();
  await page.getByLabel("Remove 4 Bedroom Semi Detached Duplex from saved properties").click();
  await page.getByRole("heading",{name:"4 Bedroom Semi Detached Duplex"}).waitFor({state:"detached"});assert.equal(listingCount(),beforeRemove-1);
  assert.equal(calls.filter(call=>call.endpoint==="/saved-properties/RES-SAVE01"&&call.method==="DELETE").length,1);

  failures.set("/saved-properties",{status:503,code:"SAVED_PROPERTIES_UNAVAILABLE",message:"Saved properties are temporarily unavailable. Please try again."});
  await page.reload();await page.getByRole("alert").filter({hasText:"temporarily unavailable"}).waitFor();failures.delete("/saved-properties");
  await page.getByRole("button",{name:"Try again"}).click();await page.locator(".saved-property-card").first().waitFor();
  savedPropertiesState.items=[];await page.reload();await page.getByText("You have no saved properties yet.").waitFor();

  resetSavedPropertiesState();
  for(const width of [1440,1280,1024,768,430,390,360,320]){
    await page.setViewportSize({width,height:920});await page.goto(origin+"/saved-properties");await page.locator(".saved-property-card").first().waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Saved Properties overflow at ${width}`);
    const columns=await page.locator(".saved-properties-grid").evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(" ").length);
    assert.equal(columns,width<=700?1:width<=900?2:3,`grid columns at ${width}`);
    if(width<=700){assert.equal(await page.getByRole("button",{name:"Toggle navigation"}).count(),1);assert.equal(await page.locator(".saved-properties-search").evaluate(element=>element.getBoundingClientRect().width>=innerWidth-50),true);}
    if(width===390)await screenshot("saved-properties-390");
  }
  await page.setViewportSize({width:1440,height:920});await page.goto(origin+"/saved-properties");await page.locator(".public-account-trigger").click();
  assert.equal(await page.locator(".public-account-dropdown").getByRole("link",{name:"Saved Property"}).getAttribute("href"),"/saved-properties");
  assert.equal(await page.locator(".public-account-dropdown").getByRole("link",{name:"Compare Property"}).getAttribute("href"),"/compare-properties");
  assert.equal(await page.locator(".public-account-dropdown").getByRole("button",{name:"Mortgage Calculator"}).getAttribute("aria-disabled"),"true");

  await page.goto(origin+"/buy");await page.getByText("Properties found for sale",{exact:false}).waitFor();
  const unsaved=page.getByRole("button",{name:/^Save /}).first();const title=(await unsaved.getAttribute("aria-label")).replace(/^Save /,"");await unsaved.click();
  await page.getByText("Property saved",{exact:true}).waitFor();assert.equal(await page.getByRole("button",{name:`${title} is saved`}).getAttribute("aria-pressed"),"true");
  assert.equal(calls.filter(call=>call.endpoint==="/saved-properties"&&call.method==="POST").length,1);
  passed.push("Saved Properties protects signed-out data, renders real safe cards, searches server-side, removes only bookmarks, shares normal Buy URLs, and handles loading/error/empty states");
  passed.push("Desktop/tablet/mobile layouts match the supplied grid/stack structure at eight widths; Saved, Compare and the existing Buy Save entry point are active while Mortgage remains unavailable");
}
