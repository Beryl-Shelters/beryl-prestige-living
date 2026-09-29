import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { errorKind, MobileApiError } from "../src/lib/api-error";
import { normalizeBaseUrl } from "../src/lib/config";
import { clearCustomerSession, restoreCustomerSession } from "../src/lib/session-lifecycle";
import type { SessionPurpose, SessionStore } from "../src/lib/session-store";

const root=process.cwd();
const read=(path:string)=>readFileSync(join(root,path),"utf8");
class MemoryStore implements SessionStore{values=new Map<SessionPurpose,string>();async get(p:SessionPurpose){return this.values.get(p)??null;}async set(p:SessionPurpose,v:string){this.values.set(p,v);}async remove(p:SessionPurpose){this.values.delete(p);}async clear(){this.values.clear();}}
const customer={id:"customer",first_name:"Ada",last_name:"Okafor",email:"ada@example.com",phone_number_normalized:null,account_type:"INVESTOR",profile_type:"PERSONAL"};

test("Expo Router exposes the five approved tabs and no Admin route",()=>{
  for(const path of ["app/(tabs)/index.tsx","app/(tabs)/properties/index.tsx","app/(tabs)/list.tsx","app/(tabs)/mortgage.tsx","app/(tabs)/account.tsx"])assert.equal(existsSync(join(root,path)),true,path);
  const layout=read("app/(tabs)/_layout.tsx");for(const name of ["index","properties","list","mortgage","account"])assert.match(layout,new RegExp(`name=\\"${name}\\"`));
  const routes=read("app/_layout.tsx")+layout;assert.doesNotMatch(routes,/admin/i);
});

test("Account shell contains signed-out and signed-in customer navigation",()=>{const account=read("app/(tabs)/account.tsx");for(const label of ["Log in","Create account","Dashboard","Saved Properties","Referrals","Withdraw Earnings","Settings","Support","Log out"])assert.match(account,new RegExp(label));});

test("API origin normalization is centralized and rejects credentials or query fragments",()=>{
  assert.equal(normalizeBaseUrl(undefined),"https://dev-api.berylshelter.com");assert.equal(normalizeBaseUrl(" https://api.example.com/ "),"https://api.example.com");
  for(const value of ["ftp://api.example.com","https://user:pass@api.example.com","https://api.example.com?secret=x"])assert.throws(()=>normalizeBaseUrl(value));
});

test("API errors classify offline, unauthorized, validation, conflict, missing and server failures",()=>{assert.equal(errorKind(401),"unauthorized");assert.equal(errorKind(403),"unauthorized");assert.equal(errorKind(400),"validation");assert.equal(errorKind(409),"conflict");assert.equal(errorKind(404),"not_found");assert.equal(errorKind(500),"server");assert.equal(new MobileApiError("network","offline").kind,"network");});

test("API transport is invoked unbound so browser fetch keeps a valid receiver",()=>{const api=read("src/lib/api-client.ts");assert.match(api,/const transport=this\.transport;response=await transport\(/);assert.doesNotMatch(api,/await this\.transport\(/);});

test("session restoration, expiry handling, offline retention and logout clearing are deterministic",async()=>{
  const store=new MemoryStore();assert.deepEqual(await restoreCustomerSession(store,async()=>customer),{status:"signedOut",customer:null});
  await store.set("account","opaque-session");assert.deepEqual(await restoreCustomerSession(store,async()=>customer),{status:"signedIn",customer});
  assert.deepEqual(await restoreCustomerSession(store,async()=>{throw new MobileApiError("network","offline");}),{status:"unavailable",customer:null});assert.equal(await store.get("account"),"opaque-session");
  assert.deepEqual(await restoreCustomerSession(store,async()=>{throw new MobileApiError("unauthorized","expired",401);}),{status:"signedOut",customer:null});assert.equal(await store.get("account"),null);
  await store.set("account","x");await store.set("verify","y");await clearCustomerSession(store);assert.equal(store.values.size,0);
});

test("Mobile source stores sessions only in SecureStore and excludes legacy financial/payment behavior",()=>{
  const session=read("src/lib/session-store.ts"),api=read("src/lib/api-client.ts");assert.match(session,/expo-secure-store/);assert.doesNotMatch(session,/AsyncStorage/);assert.match(api,/Authorization=`Bearer/);assert.match(api,/X-Beryl-Client/);
  const source=["app","src"].flatMap(folder=>readdirSync(join(root,folder),{recursive:true}).filter(name=>/\.(ts|tsx)$/.test(String(name))).map(name=>read(join(folder,String(name))))).join("\n");
  assert.doesNotMatch(source,/\b4%\b|\b0\.04\b|400\s*bps/i);assert.doesNotMatch(source,/paystack|flutterwave|service[_-]?role|SUPABASE_SERVICE/i);assert.doesNotMatch(source,/\/api\/v1\/admin/);
});

test("parity document maps canonical withdrawals, 2 percent commission and offline purchases",()=>{const parity=read("V2_MOBILE_PARITY.md");assert.match(parity,/GET \/api\/v1\/dashboard\/referrals\/withdrawals/);assert.match(parity,/2% \/ 200 basis points/);assert.match(parity,/no online property checkout/i);assert.match(parity,/Admin functionality is Web-only/);});
