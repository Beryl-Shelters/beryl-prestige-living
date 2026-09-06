import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { randomBytes } from "node:crypto";
import { createApp } from "../src/app.js";
import { authConfigSchema, loadAuthConfig } from "../src/auth/config.js";
import { AuthCipher, hashToken } from "../src/auth/crypto.js";
import { AuthError, expired, invalidCode } from "../src/auth/errors.js";
import type { AuthGateway, Customer, ProviderTokens, StoredSession } from "../src/auth/gateway.js";
import { registerSchema, resetSchema, normalizePhone } from "../src/auth/validation.js";
import { passwordValidationErrors, validateNewPassword } from "../../web/lib/password-policy.js";

const config = authConfigSchema.parse({
  webOrigin: "http://localhost:3000", apiOrigin: "http://localhost:4000",
  supabaseUrl: "https://example.supabase.co", anonKey: "test-anon", serviceKey: "test-service",
  encryptionKey: randomBytes(32).toString("base64"), cookieSecure: false, production: false, rateLimit: 100,
});
const registration = {
  firstName: "Ada", lastName: "Okafor", email: "ada@example.com", countryCode: "+234",
  phoneNumber: "08031234567", accountType: "INVESTOR", profileType: "PERSONAL",
  password: "Abcdefg!", confirmPassword: "Abcdefg!",
};
const customer: Customer = {
  id: "b0404b72-2167-4eb7-b864-1235431f9231", first_name: "Ada", last_name: "Okafor", email: registration.email,
  country_code: "+234", phone_number: registration.phoneNumber, phone_number_normalized: "+2348031234567",
  account_type: "INVESTOR", profile_type: "PERSONAL", email_verified_at: new Date().toISOString(),
};
class FakeGateway implements AuthGateway {
  profiles: Customer[] = [{ ...customer }];
  sessions = new Map<string, StoredSession>();
  calls: string[] = [];
  failLogin = false;
  failVerify = false;
  failDelivery = false;
  failPassword = false;
  invalidSession = false;
  expiry = Math.floor(Date.now() / 1000) + 3600;
  tokens(): ProviderTokens { return { accessToken: "private-access", refreshToken: "private-refresh", expiresAt: this.expiry, userId: customer.id }; }
  async findCustomer(column: "email" | "phone_number_normalized" | "id", value: string) {
    this.calls.push(`lookup:${column}`); return this.profiles.find((profile) => profile[column] === value) ?? null;
  }
  async signup() { this.calls.push("signup"); }
  async login(email: string) {
    this.calls.push(`login:${email}`);
    if (this.failLogin || email !== customer.email) throw new AuthError(401, "INVALID_CREDENTIALS", "Invalid credentials.");
    if (!this.profiles[0]?.email_verified_at) throw new AuthError(403, "EMAIL_NOT_VERIFIED", "Verify your email before logging in.");
    return this.tokens();
  }
  async verify(email: string, _code: string, type: "signup" | "recovery") {
    this.calls.push(`verify:${type}`);
    if (this.failVerify || email !== customer.email) throw invalidCode(); return this.tokens();
  }
  async resend() { this.calls.push("resend"); }
  async recover() { this.calls.push("recover"); if (this.failDelivery) throw new Error("private provider diagnostics"); }
  async validate() { if (this.invalidSession) throw expired(); }
  async refresh() { this.calls.push("refresh"); this.expiry = Math.floor(Date.now() / 1000) + 3600; return this.tokens(); }
  async updatePassword() { this.calls.push("password"); if (this.failPassword) throw new AuthError(503,"AUTH_UNAVAILABLE","Authentication is temporarily unavailable."); }
  async signOut() { this.calls.push("signout"); }
  async createSession(hash: string, userId: string, purpose: "ACCOUNT" | "RECOVERY", encrypted: string, seconds: number) {
    this.sessions.set(hash,{token_hash:hash,user_id:userId,purpose,encrypted_tokens:encrypted,expires_at:new Date(Date.now()+seconds*1000).toISOString(),refresh_lock:null});
  }
  async readSession(hash: string, purpose: "ACCOUNT" | "RECOVERY") {
    const row=this.sessions.get(hash); return row?.purpose===purpose && Date.parse(row.expires_at)>Date.now()?row:null;
  }
  async claimRefresh(hash: string, lock: string) {
    const row=await this.readSession(hash,"ACCOUNT"); if(!row || row.refresh_lock)return null; row.refresh_lock=lock; return row;
  }
  async finishRefresh(hash: string, lock: string, encrypted: string) {
    const row=this.sessions.get(hash); if(row?.refresh_lock!==lock)return false; row.encrypted_tokens=encrypted;row.refresh_lock=null;return true;
  }
  async consumeRecovery(hash: string) {
    const row=this.sessions.get(hash); if(!row || row.purpose!=="RECOVERY" || Date.parse(row.expires_at)<=Date.now())return null;
    this.sessions.delete(hash);return row;
  }
  async deleteSession(hash: string) { this.sessions.delete(hash); }
  async deleteUserSessions(id: string) { for(const [hash,row] of this.sessions)if(row.user_id===id)this.sessions.delete(hash); }
  async startGoogle() { return {url:"https://example.supabase.co/auth/v1/authorize?provider=google",verifier:"test-pkce-verifier"}; }
  async exchangeGoogle() { this.calls.push("oauth-exchange");return this.tokens(); }
}
async function fixture(t: TestContext, overrides = {}) {
  const gateway=new FakeGateway();
  const server=createApp({webAppUrl:config.webOrigin,auth:{...config,...overrides},gateway}).listen(0,"127.0.0.1");
  await new Promise<void>((resolve)=>server.once("listening",resolve));
  t.after(()=>new Promise<void>((resolve)=>{server.close(()=>resolve());server.closeAllConnections();}));
  const address=server.address();assert.ok(address && typeof address!=="string");
  const jar=new Map<string,string>();
  async function request(path:string,body?:unknown,headers:Record<string,string>={}) {
    const response=await fetch(`http://127.0.0.1:${address.port}/api/v1/auth${path}`,{
      method:body===undefined?"GET":"POST",headers:{Origin:config.webOrigin,"Content-Type":"application/json",Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join("; "),...headers},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),
    });
    for(const cookie of response.headers.getSetCookie()) {
      const pair=cookie.split(";")[0]??"";const index=pair.indexOf("=");const key=pair.slice(0,index);const value=pair.slice(index+1);
      if(value)jar.set(key,value);else jar.delete(key);
    }
    return {response,body:await response.json()};
  }
  return {gateway,request,jar};
}
const loginBody={identifier:customer.email,password:registration.password};
const resetBody={password:registration.password,confirmPassword:registration.password};

const passwordCases = [
  { name: "seven characters fail", value: "Abcdef!", valid: false },
  { name: "eight characters without any digit pass", value: "Abcdefg!", valid: true },
  { name: "longer passwords without digits pass", value: "Longer-Passphrase!", valid: true },
  { name: "missing uppercase fails", value: "abcdefg!", valid: false },
  { name: "missing lowercase fails", value: "ABCDEFG!", valid: false },
  { name: "missing symbol fails", value: "Abcdefgh", valid: false },
  { name: "missing all letters fails", value: "1234567!", valid: false },
  { name: "whitespace alone is not a symbol", value: "Abcdefg \t", valid: false },
  { name: "Unicode letters alone are not symbols", value: "Abcdefgé", valid: false },
  { name: "128 characters pass", value: "Ab!" + "x".repeat(125), valid: true },
  { name: "129 characters fail", value: "Ab!" + "x".repeat(126), valid: false },
];
for (const { name, value, valid } of passwordCases) {
  test(`registration, reset and Web password policy: ${name}`, () => {
    const body = { password: value, confirmPassword: value };
    const signup = registerSchema.safeParse({ ...registration, ...body });
    const reset = resetSchema.safeParse(body);
    const webErrors = passwordValidationErrors(value, value);
    assert.equal(signup.success, valid);
    assert.equal(reset.success, valid);
    assert.equal(webErrors.length === 0, valid);
    assert.deepEqual(signup.error?.issues.map((issue) => issue.message) ?? [], webErrors);
    assert.deepEqual(reset.error?.issues.map((issue) => issue.message) ?? [], webErrors);
    if (valid) assert.doesNotThrow(() => validateNewPassword(value, value));
    else assert.throws(() => validateNewPassword(value, value), { message: webErrors.join(" ") });
  });
}

test("confirmation mismatch still fails in registration, reset and Web validation", () => {
  const body = { password: registration.password, confirmPassword: "Another-Passphrase!" };
  for (const result of [registerSchema.safeParse({ ...registration, ...body }), resetSchema.safeParse(body)]) {
    assert.equal(result.success, false);
    assert.deepEqual(result.error?.issues.map((issue) => issue.message), ["Passwords do not match."]);
  }
  assert.deepEqual(passwordValidationErrors(body.password, body.confirmPassword), ["Passwords do not match."]);
});

test("registration and reset return every failed password rule before provider mutation", async (t) => {
  const { request, gateway } = await fixture(t);
  gateway.profiles = [];
  const invalid = { password: "123", confirmPassword: "123" };
  const expected = [
    "The password field must be at least 8 characters.",
    "The password field must contain at least one uppercase letter.",
    "The password field must contain at least one lowercase letter.",
    "The password field must contain at least one letter.",
    "The password field must contain at least one symbol.",
  ].join(" ");
  const signup = await request("/register", { ...registration, ...invalid });
  assert.equal(signup.response.status, 400);
  assert.equal(signup.body.error.message, expected);
  assert.equal(gateway.calls.includes("signup"), false);
  assert.equal((await request("/register", registration)).response.status, 201);
  gateway.profiles = [{ ...customer }];
  await request("/forgot-password", { identifier: customer.email });
  await request("/verify-recovery", { code: "123456" });
  const reset = await request("/reset-password", invalid);
  assert.equal(reset.response.status, 400);
  assert.equal(reset.body.error.message, expected);
  assert.equal(gateway.calls.includes("password"), false);
  assert.equal((await request("/recovery-context")).response.status, 200);
  assert.equal((await request("/reset-password", resetBody)).response.status, 200);
});

test("login does not apply new-password composition rules to an existing password", async (t) => {
  const { request } = await fixture(t);
  assert.equal((await request("/login", { ...loginBody, password: "legacy-password" })).response.status, 200);
});

test("registration validates names, email, phone, approved enums and matching strong passwords",()=>{
  assert.equal(registerSchema.safeParse(registration).success,true);
  for(const change of [{firstName:""},{lastName:""},{email:"not-email"},{countryCode:""},{phoneNumber:"12abc"},{accountType:"ADMIN"},{profileType:"TEAM"},{password:"short"},{confirmPassword:"different"}])assert.equal(registerSchema.safeParse({...registration,...change}).success,false);
  assert.equal(normalizePhone("08031234567","+234"),"+2348031234567");
  assert.equal(normalizePhone("+234 803 123 4567"),normalizePhone("08031234567"));
});
test("registration establishes masked verification context, without account cookies or password disclosure",async(t)=>{
  const {request,gateway,jar}=await fixture(t);gateway.profiles=[];
  const result=await request("/register",registration);
  assert.equal(result.response.status,201);assert.ok(gateway.calls.includes("signup"));
  assert.ok(jar.has("beryl_verify"));assert.equal(jar.has("beryl_account"),false);
  assert.equal((await request("/verification-context")).body.data.maskedEmail,"a***@example.com");
  assert.equal(JSON.stringify(result.body).includes(registration.password),false);
});
test("duplicate email and phone prevent signup; invalid fields never reach provider",async(t)=>{
  const {request,gateway}=await fixture(t);
  assert.equal((await request("/register",registration)).response.status,409);
  assert.equal((await request("/register",{...registration,email:"other@example.com"})).response.status,409);
  assert.equal((await request("/register",{...registration,confirmPassword:"different"})).response.status,400);
  assert.equal(gateway.calls.includes("signup"),false);
});
test("email and national/international phone login resolve the same password account",async(t)=>{
  const {request,gateway}=await fixture(t);
  for(const identifier of ["ADA@example.com","08031234567","+2348031234567"]){
    const result=await request("/login",{identifier,password:registration.password});assert.equal(result.response.status,200);
    assert.equal(JSON.stringify(result.body).includes("private-access"),false);
  }
  assert.equal(gateway.calls.filter((call)=>call===`login:${customer.email}`).length,3);
  assert.ok(gateway.calls.includes("lookup:phone_number_normalized"));
});
test("invalid login is generic; unverified login only establishes verification context",async(t)=>{
  const {request,gateway,jar}=await fixture(t);gateway.failLogin=true;
  assert.equal((await request("/login",loginBody)).body.error.message,"Invalid credentials.");
  gateway.failLogin=false;gateway.profiles[0]!.email_verified_at=null;
  assert.equal((await request("/login",loginBody)).response.status,403);
  assert.ok(jar.has("beryl_verify"));assert.equal(jar.has("beryl_account"),false);
});
test("authenticated me, encrypted storage and logout invalidate cookie replay",async(t)=>{
  const {request,gateway,jar}=await fixture(t);assert.equal((await request("/me")).response.status,401);
  const login=await request("/login",loginBody);assert.match(login.response.headers.getSetCookie().join(";"),/HttpOnly/);
  const cookie=jar.get("beryl_account")!;const row=gateway.sessions.get(hashToken(cookie))!;
  assert.ok(row);assert.equal(row.encrypted_tokens.includes("private-access"),false);
  assert.equal((await request("/me")).body.data.customer.id,customer.id);
  assert.equal((await request("/logout",{})).response.status,200);jar.set("beryl_account",cookie);
  assert.equal((await request("/me")).response.status,401);
});
test("provider rejection and database session expiry cannot access me",async(t)=>{
  const {request,gateway}=await fixture(t);await request("/login",loginBody);
  gateway.invalidSession=true;assert.equal((await request("/me")).response.status,401);gateway.invalidSession=false;
  for(const row of gateway.sessions.values())row.expires_at=new Date(0).toISOString();
  assert.equal((await request("/me")).response.status,401);
});
test("near-expiry sessions refresh and persist rotated tokens only once",async(t)=>{
  const {request,gateway}=await fixture(t);gateway.expiry=1;await request("/login",loginBody);
  assert.equal((await request("/me")).response.status,200);assert.equal((await request("/me")).response.status,200);
  assert.equal(gateway.calls.filter((call)=>call==="refresh").length,1);
});
test("forgot response is identical for email, phone, unknown user and provider delivery failure",async(t)=>{
  const {request,gateway}=await fixture(t);
  const known=await request("/forgot-password",{identifier:customer.email});
  const phone=await request("/forgot-password",{identifier:customer.phone_number});
  const unknown=await request("/forgot-password",{identifier:"missing@example.com"});gateway.failDelivery=true;
  const failed=await request("/forgot-password",{identifier:customer.email});
  for(const result of [phone,unknown,failed]){assert.equal(result.response.status,known.response.status);assert.deepEqual(result.body,known.body);}
  assert.equal(JSON.stringify(known.body).includes(customer.email),false);
});
test("account cookies cannot reset passwords and recovery cookies cannot access me",async(t)=>{
  const {request,jar}=await fixture(t);await request("/login",loginBody);
  assert.equal((await request("/reset-password",resetBody)).response.status,401);jar.clear();
  await request("/forgot-password",{identifier:customer.email});
  assert.equal((await request("/verify-recovery",{code:"123456"})).response.status,200);
  assert.ok(jar.has("beryl_recovery"));assert.equal(jar.has("beryl_account"),false);
  assert.equal((await request("/me")).response.status,401);
});
test("reset consumes the recovery grant once and revokes existing account sessions",async(t)=>{
  const {request,gateway,jar}=await fixture(t);await request("/login",loginBody);const account=jar.get("beryl_account")!;
  await request("/forgot-password",{identifier:customer.phone_number});await request("/verify-recovery",{code:"123456"});
  const recovery=jar.get("beryl_recovery")!;
  assert.equal((await request("/reset-password",resetBody)).response.status,200);
  assert.equal(gateway.calls.filter((c)=>c==="password").length,1);jar.set("beryl_recovery",recovery);jar.set("beryl_account",account);
  assert.equal((await request("/reset-password",resetBody)).response.status,401);assert.equal((await request("/me")).response.status,401);
});
test("invalid recovery OTP creates no grant; password mismatch does not consume a valid grant",async(t)=>{
  const {request,gateway,jar}=await fixture(t);await request("/forgot-password",{identifier:customer.email});gateway.failVerify=true;
  assert.equal((await request("/verify-recovery",{code:"123456"})).response.status,400);assert.equal(jar.has("beryl_recovery"),false);
  gateway.failVerify=false;await request("/verify-recovery",{code:"123456"});
  assert.equal((await request("/reset-password",{...resetBody,confirmPassword:"different"})).response.status,400);
  assert.equal((await request("/recovery-context")).response.status,200);
});
test("CSRF origins, non-JSON posts and configurable rate limits",async(t)=>{
  const {request}=await fixture(t,{rateLimit:1});
  assert.equal((await request("/login",{}, {Origin:"https://evil.example"})).response.status,403);
  assert.equal((await request("/logout",{}, {"Content-Type":"text/plain"})).response.status,403);
  await request("/login",loginBody);assert.equal((await request("/login",loginBody)).response.status,429);
});
test("Google is disabled by default and invalid OAuth state cannot exchange a code",async(t)=>{
  const disabled=await fixture(t);assert.equal((await disabled.request("/google",{})).body.error.code,"GOOGLE_NOT_CONFIGURED");
  const enabled=await fixture(t,{googleEnabled:true});await enabled.request("/google",{});
  assert.equal((await enabled.request("/google/callback",{code:"test-code",state:"attacker"})).response.status,400);
  assert.equal(enabled.gateway.calls.includes("oauth-exchange"),false);
});
test("encryption is purpose-bound and authenticated; production cookies fail closed",()=>{
  const cipher=new AuthCipher(config.encryptionKey);const sealed=cipher.seal({email:customer.email},"VERIFY");
  assert.deepEqual(cipher.open(sealed,"VERIFY"),{email:customer.email});assert.equal(cipher.open(sealed,"FORGOT"),undefined);
  const tampered=sealed.slice(0,-8)+"xxxxxxxx";assert.equal(cipher.open(tampered,"VERIFY"),undefined);
  assert.equal(loadAuthConfig({}),undefined);assert.equal(authConfigSchema.safeParse({...config,production:true,cookieSecure:false}).success,false);
});

test("email verification requires pending context, supports resend and establishes an account",async(t)=>{
  const {request,gateway,jar}=await fixture(t);
  assert.equal((await request("/verify-email",{code:"123456"})).response.status,400);
  await request("/resend-verification",{identifier:customer.email});
  assert.ok(jar.has("beryl_verify"));assert.ok(gateway.calls.includes("resend"));
  gateway.failVerify=true;assert.equal((await request("/verify-email",{code:"123456"})).response.status,400);
  assert.equal(jar.has("beryl_account"),false);gateway.failVerify=false;
  assert.equal((await request("/verify-email",{code:"123456"})).response.status,200);
  assert.ok(jar.has("beryl_account"));assert.equal(jar.has("beryl_verify"),false);
});
test("concurrent password reset attempts only update once",async(t)=>{
  const {request,gateway}=await fixture(t);
  await request("/forgot-password",{identifier:customer.email});await request("/verify-recovery",{code:"123456"});
  const outcomes=await Promise.all([request("/reset-password",resetBody),request("/reset-password",resetBody)]);
  assert.deepEqual(outcomes.map((value)=>value.response.status).sort(),[200,401]);
  assert.equal(gateway.calls.filter((call)=>call==="password").length,1);
});

test("expired recovery authorization cannot open reset context or change a password",async(t)=>{
  const {request,gateway}=await fixture(t);
  await request("/forgot-password",{identifier:customer.email});
  await request("/verify-recovery",{code:"123456"});
  assert.equal((await request("/recovery-context")).response.status,200);
  for(const row of gateway.sessions.values())if(row.purpose==="RECOVERY")row.expires_at=new Date(0).toISOString();
  assert.equal((await request("/recovery-context")).response.status,401);
  assert.equal((await request("/reset-password",resetBody)).response.status,401);
  assert.equal(gateway.calls.includes("password"),false);
});
test("a failed provider password update cannot reuse the consumed grant",async(t)=>{
  const {request,gateway,jar}=await fixture(t);
  await request("/forgot-password",{identifier:customer.email});await request("/verify-recovery",{code:"123456"});
  const grant=jar.get("beryl_recovery")!;gateway.failPassword=true;
  assert.equal((await request("/reset-password",resetBody)).response.status,503);
  jar.set("beryl_recovery",grant);gateway.failPassword=false;
  assert.equal((await request("/reset-password",resetBody)).response.status,401);
});
test("refresh lease prevents simultaneous refresh of the same token",async(t)=>{
  const {request,gateway}=await fixture(t);gateway.expiry=1;await request("/login",loginBody);
  let release!:()=>void;const gate=new Promise<void>((resolve)=>{release=resolve;});
  const original=gateway.refresh.bind(gateway);
  gateway.refresh=async()=>{await gate;return original();};
  const first=request("/me");
  // Wait until the first request owns the lease rather than relying on timing.
  for(let i=0;i<100 && ![...gateway.sessions.values()][0]?.refresh_lock;i++)await new Promise((resolve)=>setTimeout(resolve,2));
  const second=await request("/me");assert.equal(second.response.status,409);
  release();assert.equal((await first).response.status,200);
  assert.equal(gateway.calls.filter((call)=>call==="refresh").length,1);
});
test("production cookies are Secure, HttpOnly, host-only and prefixed",async(t)=>{
  const {request}=await fixture(t,{cookieSecure:true});
  const {response}=await request("/login",loginBody);
  const cookie=response.headers.getSetCookie().find((value)=>value.startsWith("__Host-beryl_account="))!;
  assert.ok(cookie);assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);assert.doesNotMatch(cookie,/Domain=/);
});
test("valid Google callback checks state before establishing an account",async(t)=>{
  const {request,jar}=await fixture(t,{googleEnabled:true});await request("/google",{});
  const context=new AuthCipher(config.encryptionKey).open<{state:string}>(decodeURIComponent(jar.get("beryl_oauth")!),"OAUTH")!;
  assert.equal((await request("/google/callback",{code:"test-code",state:context.state})).response.status,200);
  assert.ok(jar.has("beryl_account"));assert.equal(jar.has("beryl_oauth"),false);
});
