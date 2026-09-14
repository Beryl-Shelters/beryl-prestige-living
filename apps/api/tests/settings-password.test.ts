import assert from "node:assert/strict";
import { test } from "node:test";
import { settingsFixture } from "./settings-profile.fixture.js";

const valid={oldPassword:"OldPass!",newPassword:"NewPass!",confirmNewPassword:"NewPass!"};

test("settings password requires an account session, trusted origin and JSON",async t=>{
  const f=await settingsFixture(t);
  for(const cookie of ["","beryl_account=forged","beryl_recovery=settings-session"])
    assert.equal((await f.passwordRequest(valid,cookie)).response.status,401);
  assert.equal((await f.passwordRequest(valid,undefined,"https://evil.example.test")).response.status,403);
  assert.equal((await f.passwordRequest(valid,undefined,undefined,"text/plain")).response.status,403);
});

test("wrong current password is generic and never mutates provider or application state",async t=>{
  const f=await settingsFixture(t),attempt={...valid,oldPassword:"WrongPass!"};
  const {response,payload}=await f.passwordRequest(attempt);
  assert.equal(response.status,401);assert.equal(payload.error.code,"INVALID_CREDENTIALS");
  assert(!JSON.stringify(payload).includes(attempt.oldPassword));assert.equal(f.passwordState.updated,null);assert.equal(f.passwordState.active,true);
});

test("valid current password and policy-compliant password without a digit succeeds and invalidates sessions",async t=>{
  const f=await settingsFixture(t),{response,payload}=await f.passwordRequest(valid);
  assert.equal(response.status,200);assert.deepEqual(payload.data,{reauthenticate:true});
  assert.equal(f.passwordState.updated,valid.newPassword);assert.equal(f.passwordState.active,false);assert.equal(f.passwordState.signOuts,1);
  assert.match(response.headers.get("set-cookie")??"",/beryl_account=;/);assert.equal((await f.request()).response.status,401);
});

test("password policy preserves confirmation, symbol, uppercase and lowercase rules",async t=>{
  for(const body of [
    {...valid,confirmNewPassword:"Different!"},
    {...valid,newPassword:"NewPassword",confirmNewPassword:"NewPassword"},
    {...valid,newPassword:"newpass!",confirmNewPassword:"newpass!"},
    {...valid,newPassword:"NEWPASS!",confirmNewPassword:"NEWPASS!"},
    {...valid,newPassword:"Short!",confirmNewPassword:"Short!"},
  ])await t.test(body.newPassword,async child=>{const f=await settingsFixture(child);assert.equal((await f.passwordRequest(body)).response.status,400);assert.equal(f.passwordState.updated,null);});
});

test("password values are not trimmed and current and new passwords must differ",async t=>{
  const wrong=await settingsFixture(t);assert.equal((await wrong.passwordRequest({...valid,oldPassword:" OldPass!"})).response.status,401);
  const spaced=await settingsFixture(t);const value=" NewPass!";assert.equal((await spaced.passwordRequest({...valid,newPassword:value,confirmNewPassword:value})).response.status,200);assert.equal(spaced.passwordState.updated,value);
  const same=await settingsFixture(t);assert.equal((await same.passwordRequest({...valid,newPassword:valid.oldPassword,confirmNewPassword:valid.oldPassword})).response.status,400);assert.equal(same.passwordState.updated,null);
});

test("password route rejects owner and token spoofing and stores no password data",async t=>{
  const f=await settingsFixture(t);
  for(const extra of [{userId:f.other},{email:"other@example.test"},{accessToken:"browser-token"}])
    assert.equal((await f.passwordRequest({...valid,...extra})).response.status,400);
  const columns=(await f.db.query<{column_name:string}>("select column_name from information_schema.columns where table_schema='public' and table_name='customer_profiles' and column_name ilike '%password%'")).rows;
  assert.deepEqual(columns,[]);
});

test("provider failures are safe and fail closed after current-password verification",async t=>{
  const f=await settingsFixture(t);f.passwordState.failProvider=true;
  const {response,payload}=await f.passwordRequest(valid);
  assert.equal(response.status,503);assert.equal(payload.error.code,"AUTH_UNAVAILABLE");assert(!JSON.stringify(payload).includes("private provider"));
  assert.equal(f.passwordState.updated,null);assert.equal(f.passwordState.active,false);
});

test("password verification attempts are limited to five per minute",async t=>{
  const f=await settingsFixture(t);
  for(let attempt=0;attempt<5;attempt++)assert.equal((await f.passwordRequest({...valid,oldPassword:"WrongPass!"})).response.status,401);
  const {response,payload}=await f.passwordRequest({...valid,oldPassword:"WrongPass!"});
  assert.equal(response.status,429);assert.equal(payload.error.code,"RATE_LIMITED");
});
