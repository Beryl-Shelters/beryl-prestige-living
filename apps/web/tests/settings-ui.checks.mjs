import assert from "node:assert/strict";
import { dashboardFixture } from "./dashboard-ui.checks.mjs";
import { runIfMain } from "./run-ui-suite.mjs";
runIfMain(import.meta.url,"settings");

export const settingsState={profile:{firstName:"Ada",lastName:"Okafor",email:"ada@example.test",countryCode:"+234",phoneNumber:"8012345678",accountType:"INVESTOR",briefBio:"Property investor",accountName:"Ada Okafor",bankName:"Beryl Bank",accountNumber:"1234567890",streetAddress:"1 Beryl Road",zipCode:"100001",city:"Ikeja",state:"Lagos",country:"Nigeria",profileImageUrl:null},business:{companyId:"BUS-7K9M2Q",companyName:"Beryl Homes",companyEmail:"company@example.test",companyPhoneNumber:"08091234567",aboutCompany:"Quality property company",companyLogoUrl:null,streetAddress:"22 Company Road",zipCode:"900001",city:"Abuja",state:"FCT",country:"Nigeria"}};
export function settingsRequestBody(request){
  const raw=request.postData()??"";
  if(!request.headers()["content-type"]?.startsWith("multipart/form-data"))return request.postDataJSON();
  const data=raw.match(/name="data"\r\n\r\n([^]*?)\r\n--/),mime=raw.match(/name="(?:profileImage|companyLogo)"[^]*?Content-Type: ([^\r\n]+)/i);
  return {...JSON.parse(data?.[1]??"{}"),_hasImage:/name="(?:profileImage|companyLogo)"/.test(raw),_imageMime:mime?.[1]};
}
export function settingsResponse(method,body,kind="profile"){
  const target=settingsState[kind];if(method==="GET")return structuredClone(target);
  const {_hasImage,_imageMime,...data}=body,extension=_imageMime==="image/png"?"png":_imageMime==="image/jpeg"?"jpg":"webp";
  Object.assign(target,data,_hasImage?{[kind==="business"?"companyLogoUrl":"profileImageUrl"]:`https://images.example.test/${kind}.${extension}`}:{});
  if(kind==="profile")dashboardFixture.customer.profile_image_url=settingsState.profile.profileImageUrl;
  return structuredClone(target);
}

export async function checkSettings({page,origin,calls,failures,screenshot,passed,pauseRequest,resume,toast}){
  const profileEndpoint="/dashboard/settings/profile",passwordEndpoint="/dashboard/settings/password",businessEndpoint="/dashboard/settings/business";
  const ready=()=>page.getByRole("heading",{name:"Personal Information",exact:true}).waitFor();
  const open=async()=>{await page.goto(origin+"/dashboard/settings");await ready();await page.evaluate(()=>document.fonts.ready);};
  const closeError=async()=>{const item=page.locator("#settings-profile-error,#settings-business-error").last();if(await item.count()){await item.locator(".Toastify__close-button").click();await item.waitFor({state:"detached"});}};
  for(const width of [1440,1280,1024,768,390,320]){
    await page.setViewportSize({width,height:1000});await open();
    assert.equal(await page.getByRole("heading",{name:"Account Settings",level:1}).count(),1);
    assert.deepEqual(await page.getByRole("tab").allTextContents(),["Profile","Password","Business"]);
    assert.equal(await page.getByRole("tab",{name:"Profile"}).getAttribute("aria-selected"),"true");
    assert.equal(await page.getByRole("tab",{name:"Business"}).isDisabled(),false);
    assert.equal(await page.getByRole("link",{name:"Verify Account"}).count(),1);
    for(const heading of ["Personal Information","Profile Picture *","Account Information","Address"])assert.equal(await page.getByRole("heading",{name:heading,exact:true}).count(),1);
    assert.equal(await page.getByLabel("Email Address").isEditable(),false);
    assert.equal(await page.getByLabel("First Name *").inputValue(),"Ada");
    assert.equal(await page.getByLabel("Account Number").inputValue(),"1234567890");
    assert.equal(await page.getByLabel("Street Address *").inputValue(),"1 Beryl Road");
    assert.equal(await page.locator('input[type="file"]').getAttribute("accept"),".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp");
    await page.getByRole("tab",{name:"Password"}).click();
    assert.equal(await page.getByRole("tab",{name:"Password"}).getAttribute("aria-selected"),"true");
    assert.equal(await page.getByRole("heading",{name:"Password",exact:true}).count(),1);
    for(const [name,autocomplete] of [["Old Password","current-password"],["New Password","new-password"],["Confirm New Password","new-password"]]){
      const input=page.getByLabel(name,{exact:true});assert.equal(await input.getAttribute("type"),"password");assert.equal(await input.getAttribute("autocomplete"),autocomplete);
    }
    await page.getByRole("tab",{name:"Business"}).click();await page.getByRole("heading",{name:"Company Information",exact:true}).waitFor();
    assert.equal(await page.getByRole("tab",{name:"Business"}).getAttribute("aria-selected"),"true");
    for(const heading of ["Company Information","Company Logo","Company Address"])assert.equal(await page.getByRole("heading",{name:heading,exact:true}).count(),1);
    assert.equal(await page.getByLabel("Company ID").inputValue(),"BUS-7K9M2Q");assert.equal(await page.getByLabel("Company ID").isEditable(),false);
    assert.equal(await page.getByLabel("Company Email Address *").inputValue(),"company@example.test");assert.equal(await page.getByLabel("Street Address *").inputValue(),"22 Company Road");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Settings overflow at ${width}`);
    await screenshot(`settings-business-${width}`);
  }
  passed.push("Profile and Password reference layouts, shared identity header, exact password fields and responsive stacking at six widths");

  await page.setViewportSize({width:1440,height:1000});await open();
  await page.getByRole("tab",{name:"Password"}).click();
  for(const name of ["Old Password","New Password","Confirm New Password"]){
    const input=page.getByLabel(name,{exact:true}),show=page.getByRole("button",{name:`Show ${name.toLowerCase()}`,exact:true});
    assert.equal(await show.locator("svg").count(),1);await show.click();assert.equal(await input.getAttribute("type"),"text");
    await page.getByRole("button",{name:`Hide ${name.toLowerCase()}`,exact:true}).click();assert.equal(await input.getAttribute("type"),"password");
  }
  await page.getByRole("tab",{name:"Profile"}).click();
  assert.equal(await page.locator(".settings-avatar img").count(),0);assert.deepEqual(await page.locator(".settings-avatar").allTextContents(),["AO","AO"]);
  const profileWrites=()=>calls.filter(call=>call.endpoint===profileEndpoint&&call.method==="PATCH"),before=profileWrites().length;
  await page.getByLabel("First Name *").fill("Unsaved");await page.getByRole("button",{name:"Cancel",exact:true}).click();
  assert.equal(await page.getByLabel("First Name *").inputValue(),"Ada");assert.equal(profileWrites().length,before);
  await page.getByLabel("First Name *").fill("Amara");await page.getByRole("button",{name:"Save Changes",exact:true}).click();await toast("Profile updated successfully");
  for(const image of [{name:"profile.png",mimeType:"image/png",buffer:Buffer.from("89504e470d0a1a0a","hex"),extension:"png"},{name:"profile.jpg",mimeType:"image/jpeg",buffer:Buffer.from("ffd8ffdb","hex"),extension:"jpg"},{name:"profile.webp",mimeType:"image/webp",buffer:Buffer.from("RIFF0000WEBP0"),extension:"webp"}]){
    await page.locator('input[type="file"]').setInputFiles(image);await page.getByRole("button",{name:"Save Changes",exact:true}).click();await toast("Profile updated successfully");
    assert.equal(profileWrites().at(-1).body._imageMime,image.mimeType);assert.match(settingsState.profile.profileImageUrl,new RegExp(`profile\\.${image.extension}$`));
  }
  assert.equal(await page.locator(".settings-avatar img").count(),2);assert.equal(await page.locator(".settings-avatar").first().evaluate(element=>getComputedStyle(element).backgroundColor),"rgba(0, 0, 0, 0)");
  await page.locator(".dashboard-avatar img").waitFor();assert.match(await page.locator(".dashboard-avatar img").getAttribute("src"),/profile\.webp$/);
  failures.set(profileEndpoint,{status:400,code:"INVALID_PROFILE_IMAGE",message:"Profile image must be PNG, JPEG, or WebP."});
  await page.locator('input[type="file"]').setInputFiles({name:"profile.svg",mimeType:"image/svg+xml",buffer:Buffer.from("<svg/>")});await page.getByRole("button",{name:"Save Changes",exact:true}).click();await toast("Profile image must be PNG, JPEG, or WebP.");
  failures.delete(profileEndpoint);await closeError();await page.getByRole("button",{name:"Cancel",exact:true}).click();
  passed.push("Profile Cancel/save/upload, transparent avatars, unsupported-image errors and sidebar refresh remain working");

  const observed=pauseRequest(profileEndpoint),navigation=page.goto(origin+"/dashboard/settings");await observed;
  assert.equal(await page.getByRole("status",{name:"Loading"}).count(),1);resume();await navigation;await ready();
  failures.set(profileEndpoint,{status:503,code:"SETTINGS_UNAVAILABLE",message:"Settings are temporarily unavailable. Please try again."});
  await page.goto(origin+"/dashboard/settings");await page.getByRole("button",{name:"Try again"}).waitFor();await toast("Settings are temporarily unavailable. Please try again.");
  failures.delete(profileEndpoint);await closeError();await page.getByRole("button",{name:"Try again"}).click();await ready();
  passed.push("Profile loading and load-error retry states remain working");

  await open();const businessObserved=pauseRequest(businessEndpoint);await page.getByRole("tab",{name:"Business"}).click();await businessObserved;assert.equal(await page.getByRole("status",{name:"Loading"}).count(),1);resume();await page.getByRole("heading",{name:"Company Information",exact:true}).waitFor();
  const businessWrites=()=>calls.filter(call=>call.endpoint===businessEndpoint&&call.method==="PATCH"),businessBefore=businessWrites().length;
  await page.getByLabel("Company Name *").fill("Unsaved Company");await page.getByRole("button",{name:"Cancel",exact:true}).click();assert.equal(await page.getByLabel("Company Name *").inputValue(),"Beryl Homes");assert.equal(businessWrites().length,businessBefore);
  await page.getByLabel("Company Name *").fill("Beryl Estates");await page.getByRole("button",{name:"Save Changes",exact:true}).click();await toast("Business profile updated successfully");assert.equal(businessWrites().at(-1).body.companyName,"Beryl Estates");assert.equal(businessWrites().at(-1).body.companyId,undefined);
  await page.getByLabel("Company Logo Upload").setInputFiles({name:"logo.webp",mimeType:"image/webp",buffer:Buffer.from("RIFF0000WEBP0")});await page.getByRole("button",{name:"Save Changes",exact:true}).click();await toast("Business profile updated successfully");assert.equal(businessWrites().at(-1).body._imageMime,"image/webp");assert.equal(await page.locator(".settings-avatar.company").first().evaluate(element=>getComputedStyle(element).backgroundColor),"rgba(0, 0, 0, 0)");
  failures.set(businessEndpoint,{status:503,code:"SETTINGS_UNAVAILABLE",message:"Settings are temporarily unavailable. Please try again."});await page.getByRole("tab",{name:"Profile"}).click();await page.getByRole("tab",{name:"Business"}).click();await page.getByRole("button",{name:"Try again"}).waitFor();await toast("Settings are temporarily unavailable. Please try again.");failures.delete(businessEndpoint);await closeError();await page.getByRole("button",{name:"Try again"}).click();await page.getByRole("heading",{name:"Company Information",exact:true}).waitFor();
  passed.push("Business owner fields, stable read-only ID, separate address, Cancel/save/logo, transparent logo and loading/error/retry work");

  failures.set(profileEndpoint,{status:401,code:"SESSION_EXPIRED",message:"Your session has expired. Please log in again."});await page.goto(origin+"/dashboard/settings");await page.waitForURL(origin+"/login");failures.delete(profileEndpoint);await open();

  await page.getByRole("tab",{name:"Password"}).click();
  const old=page.getByLabel("Old Password",{exact:true}),next=page.getByLabel("New Password",{exact:true}),confirm=page.getByLabel("Confirm New Password",{exact:true});
  const passwordWrites=()=>calls.filter(call=>call.endpoint===passwordEndpoint&&call.method==="PATCH");
  let count=passwordWrites().length;await old.fill("OldPass!");await next.fill("NewPass!");await confirm.fill("NewPass!");await page.getByRole("button",{name:"Cancel",exact:true}).click();
  assert.deepEqual([await old.inputValue(),await next.inputValue(),await confirm.inputValue()],["","",""]);assert.equal(passwordWrites().length,count);
  count=passwordWrites().length;await old.fill("OldPass!");await next.fill("NewPass!");await confirm.fill("Different!");
  await page.getByRole("button",{name:"Save Changes",exact:true}).click();await toast("Passwords do not match.");assert.equal(passwordWrites().length,count);await closeError();
  failures.set(passwordEndpoint,{status:401,code:"INVALID_CREDENTIALS",message:"Current password is incorrect."});
  await old.fill("WrongPass!");await next.fill("NewPass!");await confirm.fill("NewPass!");await page.getByRole("button",{name:"Save Changes",exact:true}).click();await toast("Current password is incorrect.");
  assert.equal(page.url(),origin+"/dashboard/settings");assert.equal(await old.inputValue(),"WrongPass!");failures.delete(passwordEndpoint);await closeError();
  await old.fill("OldPass!");const passwordObserved=pauseRequest(passwordEndpoint);await page.getByRole("button",{name:"Save Changes",exact:true}).click();await passwordObserved;assert.equal(await page.getByRole("button",{name:"Saving...",exact:true}).isDisabled(),true);resume();await toast("Password changed successfully. Please log in again.");await page.waitForURL(origin+"/login");
  assert.deepEqual(passwordWrites().at(-1).body,{oldPassword:"OldPass!",newPassword:"NewPass!",confirmNewPassword:"NewPass!"});
  passed.push("Password Cancel, client validation, wrong-current-password handling, pending lock, session expiry, exact payload and successful forced re-login");
}
