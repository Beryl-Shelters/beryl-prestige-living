import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  BRAND_SPLASH_DURATION_MS,
  launchDelay,
  launchDestination,
  MAX_SESSION_RESTORE_WAIT_MS,
  ONBOARDING_INTERVAL_MS,
  RETURNING_SESSION_SPLASH_MS,
  nextOnboardingSlide,
  onboardingPage,
  shouldAutoAdvance,
  splashDuration,
} from "../src/lib/onboarding";

const root=process.cwd();
const read=(path:string)=>readFileSync(join(root,path),"utf8");

test("cold signed-out launch uses the full brand sequence while restored sessions remain fast",()=>{
  assert.equal(BRAND_SPLASH_DURATION_MS,6000);
  assert.equal(RETURNING_SESSION_SPLASH_MS,900);
  assert.equal(splashDuration("signedOut"),6000);
  assert.equal(splashDuration("signedIn"),900);
  assert.equal(splashDuration("unavailable"),900);
  assert.equal(splashDuration("signedOut",true),0);
  assert.equal(launchDelay("signedOut",0),6000);
  assert.equal(launchDelay("signedOut",2500),3500);
  assert.equal(launchDelay("signedIn",1000),0);
  assert.equal(MAX_SESSION_RESTORE_WAIT_MS,12000);
  assert.equal(launchDelay("loading",11999),1);
  assert.equal(launchDestination("signedOut","/"),"onboarding");
  assert.equal(launchDestination("signedIn","/"),"hidden");
  assert.equal(launchDestination("signedOut","/(auth)/login"),"hidden");
});

test("launch completion is bounded independently of the decorative animation",()=>{
  const launch=read("src/components/launch-experience.tsx"),brand=read("src/components/brand-splash.tsx");
  assert.match(launch,/useRef<number \| null>\(null\)/);
  assert.match(launch,/startedAt\.current === null\) startedAt\.current = Date\.now\(\)/);
  assert.match(launch,/launchDelay\(status, Date\.now\(\) - startedAt\.current\)/);
  assert.match(launch,/phase !== "transition"/);
  assert.match(launch,/launchDestination\(latestStatus\.current, latestPathname\.current\)/);
  assert.doesNotMatch(launch,/onExited=/);
  assert.match(brand,/Animated\.loop/);
  assert.doesNotMatch(brand,/onExited/);
});

test("carousel advances every 3.5 seconds and loops deterministically",()=>{
  assert.equal(ONBOARDING_INTERVAL_MS,3500);
  assert.equal(nextOnboardingSlide(0,3),1);
  assert.equal(nextOnboardingSlide(1,3),2);
  assert.equal(nextOnboardingSlide(2,3),0);
  assert.equal(onboardingPage(0,390,3),0);
  assert.equal(onboardingPage(410,390,3),1);
  assert.equal(onboardingPage(780,390,3),2);
});

test("background, focus and reduced-motion rules pause automatic movement",()=>{
  assert.equal(shouldAutoAdvance(true,"active",false),true);
  assert.equal(shouldAutoAdvance(false,"active",false),false);
  assert.equal(shouldAutoAdvance(true,"background",false),false);
  assert.equal(shouldAutoAdvance(true,"active",true),false);
});

test("onboarding uses supplied assets, approved copy, paging and existing routes",()=>{
  for(const asset of ["refer-and-earn.png","verified-home.png","sell-with-trust.png","charcoal-texture.jpg"]){
    assert.equal(existsSync(join(root,"assets/onboarding",asset)),true,asset);
  }
  const carousel=read("src/components/onboarding-carousel.tsx");
  for(const copy of ["Refer a buyer to us and earn up to ₦2M","Find a verified home you'll love","Sell with people you can trust","Since 2001 · every property verified by our team","Refer and earn","Track a referral"]){
    assert.match(carousel,new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  }
  assert.match(carousel,/horizontal/);
  assert.match(carousel,/pagingEnabled/);
  assert.match(carousel,/onMomentumScrollEnd/);
  assert.match(carousel,/onScrollBeginDrag/);
  assert.match(carousel,/AppState\.addEventListener/);
  assert.match(carousel,/useFocusEffect/);
  assert.match(carousel,/\"\/\(auth\)\/login\"/);
  assert.match(carousel,/\"\/\(auth\)\/register\"/);
  assert.match(carousel,/\"\/dashboard\/referrals\"/);
});

test("onboarding heroes remain contained and the enlarged brand stays readable throughout its entrance",()=>{
  const carousel=read("src/components/onboarding-carousel.tsx"),splash=read("src/components/brand-splash.tsx");
  assert.match(carousel,/height \* \(compact \? 0\.28 : 0\.33\)/);
  assert.match(carousel,/resizeMode="contain"/);
  assert.match(carousel,/flexShrink: 1/);
  assert.doesNotMatch(carousel,/maxWidth: 560/);
  assert.match(splash,/>BERYL<\/Text> Shelter/);
  assert.match(splash,/>NIGERIA LIMITED<\/Text>/);
  assert.match(splash,/availableWidth \* 0\.56/);
  assert.match(splash,/availableHeight \* 0\.29/);
  assert.match(splash,/Math\.max\(32, Math\.min\(availableWidth \* 0\.095, 38\)\)/);
  assert.match(splash,/onLayout=\{\(event\) =>/);
  assert.match(splash,/outputRange: \[0\.94, 1\]/);
  assert.doesNotMatch(splash,/opacity: reveal/);
  assert.match(splash,/fontWeight: "800"/);
  assert.doesNotMatch(splash,/styles\.glow/);
  assert.doesNotMatch(splash,/borderRadius: 115/);
  assert.doesNotMatch(splash,/width: 230/);
});

test("native splash waits for textured brand assets and deep-link handling remains isolated",()=>{
  const layout=read("app/_layout.tsx"),intent=read("app/+native-intent.tsx"),config=JSON.parse(read("app.json"));
  const brandSplash=read("src/components/brand-splash.tsx"),launchExperience=read("src/components/launch-experience.tsx");
  const splashPlugin=config.expo.plugins.find((plugin:unknown)=>Array.isArray(plugin)&&plugin[0]==="expo-splash-screen");
  assert.match(layout,/preventAutoHideAsync/);
  assert.match(layout,/onLayout=\{onRootLayout\}/);
  assert.match(layout,/!rootLaidOut\.current \|\| !visualReady\.current/);
  assert.match(layout,/onVisualReady=\{onVisualReady\}/);
  assert.match(layout,/hideAsync/);
  assert.match(layout,/LaunchExperience/);
  assert.match(layout,/backgroundColor: "#242424"/);
  assert.match(launchExperience,/backgroundColor: "#242424"/);
  assert.match(intent,/mobilePathFromIncoming/);
  assert.equal(config.expo.splash,undefined);
  assert.ok(Array.isArray(splashPlugin));
  assert.equal(splashPlugin[1].backgroundColor,"#242424");
  assert.equal(splashPlugin[1].dark.backgroundColor,"#242424");
  assert.equal(splashPlugin[1].image,"../web/public/brand/beryl-shelter-logo.png");
  assert.equal(splashPlugin[1].imageWidth,180);
  assert.equal(existsSync(join(root,"../web/public/brand/beryl-shelter-logo.png")),true);
  assert.match(brandSplash,/onLoadEnd=\{\(\) => markLoaded\("texture"\)\}/);
  assert.match(brandSplash,/onLoadEnd=\{\(\) => markLoaded\("logo"\)\}/);
  assert.match(launchExperience,/onReady=\{onVisualReady\}/);
  assert.match(brandSplash,/>BERYL<\/Text> Shelter/);
  assert.match(brandSplash,/>NIGERIA LIMITED<\/Text>/);
});

test("carousel keeps images mounted and never fades them during a page change",()=>{
  const carousel=read("src/components/onboarding-carousel.tsx");
  assert.match(carousel,/initialNumToRender=\{carouselSlides\.length\}/);
  assert.match(carousel,/setMoving\(true\)/);
  assert.match(carousel,/onMomentumScrollEnd=.*settleAt/);
  assert.match(carousel,/setTimerEpoch\(\(value\) => value \+ 1\)/);
  assert.match(carousel,/key: "refer-loop"/);
  assert.match(carousel,/page === slides\.length/);
  assert.match(carousel,/animated: false/);
  assert.doesNotMatch(carousel,/contentAnimation|animateContent/);
});
