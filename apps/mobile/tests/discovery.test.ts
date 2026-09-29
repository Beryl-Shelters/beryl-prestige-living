import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { toggleComparison } from "../src/lib/comparison";
import { calculateMortgage, mortgageTerms } from "../src/lib/mortgage";
import { canonicalPropertyUrl, mobilePathFromIncoming } from "../src/lib/property-links";
import { createPropertiesApi, propertyQuery } from "../src/lib/properties-api-core";
import { emptyPropertyFilters, type PublicProperty } from "../src/lib/property-types";

const root=process.cwd();const read=(path:string)=>readFileSync(join(root,path),"utf8");
const property=(code:string):PublicProperty=>({code,title:`Property ${code}`,description:"Canonical test response",propertyType:"Residential",propertySubtype:"Bungalow",priceMinor:5000000000,state:"Lagos",city:"Lekki",bedrooms:3,bathrooms:3,parkingSpaces:2,facilities:[],listedAt:"2026-09-29T00:00:00Z",images:[]});

test("public property requests use canonical endpoints, public codes and server-side filters",async()=>{
  const calls:{path:string;options:unknown}[]=[];const client={request:async<T>(path:string,options?:unknown)=>{calls.push({path,options});return {} as T}};const api=createPropertiesApi(client as never);
  const filters={...emptyPropertyFilters,propertyType:"Residential",state:"Federal Capital Territory (FCT)",maxPrice:"50,000,000",bedrooms:"7+",facility:"CCTV",sort:"price_asc" as const};
  const query=propertyQuery("  Lekki  ",filters,2,10);await api.list(query);await api.detail("RES-ABC123");
  assert.equal(query.get("q"),"Lekki");assert.equal(query.get("state"),"Federal Capital Territory (FCT)");assert.equal(query.get("maxPrice"),"5000000000");assert.equal(query.get("bedroomsMin"),"7");assert.equal(query.get("facility"),"CCTV");assert.equal(query.get("page"),"2");
  assert.match(calls[0]!.path,/^\/api\/v1\/public\/properties\?/);assert.equal((calls[0]!.options as {authenticated:boolean}).authenticated,false);assert.equal(calls[1]!.path,"/api/v1/public/properties/RES-ABC123");assert.doesNotMatch(calls.map(call=>call.path).join("\n"),/[0-9a-f]{8}-[0-9a-f]{4}-/i);
});

test("saved, unsaved, states and compare use authenticated canonical contracts without lifecycle mutation",async()=>{
  const calls:{path:string;options:Record<string,unknown>|undefined}[]=[];const client={request:async<T>(path:string,options?:Record<string,unknown>)=>{calls.push({path,options});return {} as T}};const api=createPropertiesApi(client as never);
  await api.save("RES-ONE");await api.unsave("RES-ONE");await api.savedStates(["RES-ONE","RES-TWO"]);await api.compare(["RES-ONE","RES-TWO"]);
  assert.deepEqual(calls.map(call=>[call.path,call.options?.method]),[["/api/v1/saved-properties","POST"],["/api/v1/saved-properties/RES-ONE","DELETE"],["/api/v1/saved-properties/states?codes=RES-ONE%2CRES-TWO",undefined],["/api/v1/saved-properties/compare?codes=RES-ONE%2CRES-TWO",undefined]]);
  assert.doesNotMatch(JSON.stringify(calls),/unlist|listing_status|request-approval/i);
});

test("comparison prevents duplicates, caps selection at three and remains an in-memory public-code model",()=>{
  const one=toggleComparison([],property("RES-1"));const duplicate=toggleComparison(one.items,property("RES-1"));assert.equal(duplicate.outcome,"removed");
  const two=toggleComparison(toggleComparison(one.items,property("RES-2")).items,property("RES-3"));assert.equal(two.items.length,3);const limit=toggleComparison(two.items,property("RES-4"));assert.equal(limit.outcome,"limit");assert.equal(limit.items.length,3);
  const provider=read("src/providers/property-state-provider.tsx");assert.doesNotMatch(provider,/SecureStore|AsyncStorage|apiClient\.request/);assert.match(provider,/useState<PublicProperty\[\]>/);
});

test("mortgage terms and fixed-rate calculations exactly match Customer Web including zero interest",()=>{
  assert.deepEqual(mortgageTerms,[5,10,15,20,25,30]);
  assert.deepEqual(calculateMortgage(5000000000,1000000000,20,12),{monthlyPaymentMinor:44043445,totalRepaymentMinor:10570426882,totalInterestMinor:6570426882});
  assert.deepEqual(calculateMortgage(5000000000,1000000000,20,0),{monthlyPaymentMinor:16666667,totalRepaymentMinor:4000000000,totalInterestMinor:0});
  assert.deepEqual(calculateMortgage(5000000000,5000000000,30,9),{monthlyPaymentMinor:0,totalRepaymentMinor:0,totalInterestMinor:0});
});

test("canonical sharing and referral-aware deep links expose no UUID or private URL",()=>{
  assert.equal(canonicalPropertyUrl("RES-ABC123"),"https://dev.berylshelter.com/buy/RES-ABC123");
  assert.equal(canonicalPropertyUrl("RES-ABC123","REF-CODE"),"https://dev.berylshelter.com/buy/RES-ABC123?ref=REF-CODE");
  assert.equal(mobilePathFromIncoming("https://dev.berylshelter.com/buy/RES-ABC123?ref=REF-CODE"),"/properties/RES-ABC123?ref=REF-CODE");
  assert.equal(mobilePathFromIncoming("https://dev.berylshelter.com/buy?code=RES-ABC123&ref=REF-CODE"),"/properties/RES-ABC123?ref=REF-CODE");
  assert.equal(mobilePathFromIncoming("%%%"),"/%%%");assert.throws(()=>canonicalPropertyUrl("not valid"));
});

test("Phase 2 screens use live APIs, truthful states, galleries, pagination and accessible controls",()=>{
  const home=read("app/(tabs)/index.tsx"),properties=read("src/components/property-list-screen.tsx"),detail=read("app/(tabs)/properties/[propertyCode].tsx"),saved=read("app/saved-properties.tsx"),compare=read("app/compare-properties.tsx"),mortgage=read("app/(tabs)/mortgage.tsx");
  assert.match(home,/propertiesApi\.list/);assert.doesNotMatch(home,/const\s+(properties|listings)\s*=\s*\[/i);assert.match(properties,/FlatList/);assert.match(properties,/Load more properties/);assert.match(properties,/PropertyFilterSheet/);assert.match(properties,/Try again/);
  assert.match(detail,/property\.images\.length/);assert.match(detail,/Photo unavailable/);assert.match(detail,/publicly listed/);assert.match(detail,/Open property in Maps/);assert.match(saved,/Sign in to view saved properties/);assert.match(compare,/2 minimum|at least two/i);assert.match(mortgage,/informational only/i);
  for(const source of [home,properties,detail,saved,compare,mortgage])assert.match(source,/accessibility(Label|Role|State)|TextField/);
});

test("privacy and business invariants remain explicit in Mobile and API public repository",()=>{
  const repository=read("../api/src/public-properties/repository.ts"),source=["app/(tabs)/index.tsx","app/(tabs)/properties/index.tsx","app/(tabs)/properties/[propertyCode].tsx","app/(tabs)/mortgage.tsx","app/saved-properties.tsx","app/compare-properties.tsx","src/lib/properties-api.ts"].map(read).join("\n");
  assert.match(repository,/eq\("listing_status", "LISTED"\)/);assert.doesNotMatch(repository,/customer_listing_documents|sales_mandate_documents|public_id/);assert.doesNotMatch(source,/\b4%\b|400\s*bps|paystack|flutterwave|Buy Now|\/api\/v1\/admin/i);assert.match(source,/2%/);assert.match(source,/offline/i);assert.match(source,/no online checkout/i);
});

test("parity records completed Phase 2 without marking viewing, Sell, Dashboard or withdrawals complete",()=>{
  const parity=read("V2_MOBILE_PARITY.md");assert.match(parity,/Discovery \(complete\)/);assert.match(parity,/there is no canonical featured flag/i);assert.match(parity,/2% \/ 200 bps/);assert.match(parity,/Property Viewing[^\n]+Planned/);assert.match(parity,/Create\/edit listing[^\n]+Planned/);assert.match(parity,/Submit withdrawal[^\n]+Planned/);assert.match(parity,/Admin functionality is Web-only/);
});
