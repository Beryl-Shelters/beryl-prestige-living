import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, randomBytes } from "node:crypto";
import { authConfigSchema } from "../src/auth/config.js";
import { SupabaseAuthGateway } from "../src/auth/gateway.js";

const config = authConfigSchema.parse({ webOrigin:"http://localhost:3000",apiOrigin:"http://localhost:4000",
  supabaseUrl:"https://example.supabase.co",anonKey:"test-public-key",serviceKey:"test-private-key",
  encryptionKey:randomBytes(32).toString("base64"),cookieSecure:false,production:false,googleEnabled:true });
const registration = { firstName:"Ada",lastName:"Okafor",email:"ada@example.com",countryCode:"+234",phoneNumber:"08031234567",
  accountType:"INVESTOR" as const,profileType:"PERSONAL" as const,password:"long-test-password",confirmPassword:"long-test-password" };
const providerSession = {
  access_token:"test-access",refresh_token:"test-refresh",token_type:"bearer",expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,
  user:{id:"b0404b72-2167-4eb7-b864-1235431f9231",email:"ada@example.com",email_confirmed_at:new Date().toISOString(),
    app_metadata:{provider:"google"},user_metadata:{},identities:[{provider:"google"}]},
};

test("Supabase signup checks confirmation setting before creating any identity",async()=>{
  let calls=0;
  const transport:typeof fetch=async(input)=>{
    calls++;assert.match(String(input),/\/settings$/);
    return Response.json({mailer_autoconfirm:true});
  };
  const gateway=new SupabaseAuthGateway(config,transport);
  await assert.rejects(()=>gateway.signup(registration,"+2348031234567"),{code:"EMAIL_CONFIRMATION_REQUIRED"});
  assert.equal(calls,1);
});
test("normal signup uses anon credentials and profile metadata, with no confirmation password copied",async()=>{
  const transport:typeof fetch=async(input,init)=>{
    if(String(input).endsWith("/settings"))return Response.json({mailer_autoconfirm:false});
    assert.match(String(input),/\/signup$/);
    assert.equal(new Headers(init?.headers).get("apikey"),config.anonKey);
    const body=JSON.parse(String(init?.body));
    assert.equal(body.data.phone_number_normalized,"+2348031234567");
    assert.equal(body.data.password,undefined);assert.equal(body.confirmPassword,undefined);
    return Response.json({id:providerSession.user.id,email:registration.email,identities:[{provider:"email"}],user_metadata:body.data});
  };
  await new SupabaseAuthGateway(config,transport).signup(registration,"+2348031234567");
});
test("Google PKCE verifier survives the server cookie round trip and matches the authorization challenge",async()=>{
  let challenge="";
  const transport:typeof fetch=async(input,init)=>{
    if(String(input).endsWith("/settings"))return Response.json({external:{google:true}});
    assert.match(String(input),/grant_type=pkce/);
    assert.equal(new Headers(init?.headers).get("apikey"),config.anonKey);
    const body=JSON.parse(String(init?.body));
    assert.equal(body.auth_code,"one-time-test-code");
    assert.equal(createHash("sha256").update(body.code_verifier).digest("base64url"),challenge);
    return Response.json(providerSession);
  };
  const gateway=new SupabaseAuthGateway(config,transport);
  const start=await gateway.startGoogle("state-value");const url=new URL(start.url);
  challenge=url.searchParams.get("code_challenge")!;
  assert.ok(challenge);assert.equal(url.searchParams.get("code_challenge_method"),"s256");
  assert.match(url.searchParams.get("redirect_to")!,/^http:\/\/localhost:3000\/auth\/callback\?state=state-value/);
  const result=await gateway.exchangeGoogle("one-time-test-code",start.verifier);
  assert.equal(result.userId,providerSession.user.id);
});
test("Supabase OTP verification distinguishes signup from recovery and uses public credentials",async()=>{
  const observed:string[]=[];
  const transport:typeof fetch=async(input,init)=>{
    assert.match(String(input),/\/verify$/);assert.equal(new Headers(init?.headers).get("apikey"),config.anonKey);
    observed.push(JSON.parse(String(init?.body)).type);return Response.json(providerSession);
  };
  const gateway=new SupabaseAuthGateway(config,transport);
  await gateway.verify(registration.email,"123456","signup");await gateway.verify(registration.email,"123456","recovery");
  assert.deepEqual(observed,["signup","recovery"]);
});

test("expired provider OTPs use a safe combined invalid/expired response",async()=>{
  const transport:typeof fetch=async()=>Response.json({code:"otp_expired",msg:"Private upstream details"},{status:403});
  const gateway=new SupabaseAuthGateway(config,transport);
  for(const type of ["signup","recovery"] as const){
    await assert.rejects(()=>gateway.verify(registration.email,"123456",type),{
      code:"INVALID_OR_EXPIRED_CODE",status:400,
      message:"The verification code is invalid or expired. Request a new code.",
    });
  }
});

test("provider resend limits remain safe 429 responses",async()=>{
  const transport:typeof fetch=async()=>Response.json({code:"over_email_send_rate_limit",msg:"Private upstream details"},{status:429});
  await assert.rejects(()=>new SupabaseAuthGateway(config,transport).resend(registration.email),{
    code:"RATE_LIMITED",status:429,message:"Too many requests. Please wait before trying again.",
  });
});
