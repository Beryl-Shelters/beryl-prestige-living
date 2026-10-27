import assert from "node:assert/strict";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const root=join(process.cwd(),".expo-web");
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".ttf":"font/ttf",".ico":"image/x-icon"};
const server=createServer((request,response)=>{const raw=decodeURIComponent((request.url??"/").split("?")[0]??"/");let path=normalize(join(root,raw));if(!path.startsWith(root)){response.writeHead(403).end();return;}if(existsSync(path)&&statSync(path).isDirectory())path=join(path,"index.html");if(!existsSync(path)&&existsSync(`${path}.html`))path=`${path}.html`;if(!existsSync(path))path=join(root,"index.html");response.setHeader("Content-Type",types[extname(path)]??"application/octet-stream");createReadStream(path).pipe(response);});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address();assert.ok(address&&typeof address!=="string");const origin=`http://127.0.0.1:${address.port}`;
const cors={"access-control-allow-origin":"*","access-control-allow-headers":"X-Beryl-Client, Authorization, Content-Type","access-control-allow-methods":"GET, POST, OPTIONS"};
const profiles=[{width:320,height:640},{width:360,height:800},{width:390,height:853},{width:430,height:900}];
const browser=await chromium.launch({headless:true});
try{
  for(const profile of profiles){
    const context=await browser.newContext({viewport:profile}),page=await context.newPage();
    const errors=[];page.on("pageerror",error=>errors.push(error.message));page.on("console",message=>{if(message.type()==="error"&&!message.text().includes("favicon"))errors.push(message.text());});
    await page.route("**/api/v1/**",route=>route.request().method()==="OPTIONS"?route.fulfill({status:204,headers:cors}):route.fulfill({status:200,headers:cors,contentType:"application/json",body:JSON.stringify({success:true,data:{items:[],page:1,pageSize:10,total:0,totalPages:0}})}));
    await page.goto(origin,{waitUntil:"domcontentloaded"});const splash=page.getByLabel("BERYL Shelter Nigeria Limited");await splash.waitFor();const started=Date.now();
    await page.waitForFunction((minimum)=>{
      const image=[...document.querySelectorAll('[aria-label="BERYL Shelter Nigeria Limited"] img')].at(-1);
      return image?.parentElement&&image.parentElement.getBoundingClientRect().width>=minimum;
    },150,{timeout:4000});
    const brandMark=await splash.locator("img").last().locator("..").boundingBox();
    assert.ok(brandMark&&brandMark.width>=150,`Brand mark too small at ${profile.width}x${profile.height}`);
    assert.equal(await splash.getByText("NIGERIA LIMITED").isVisible(),true);
    await page.getByRole("heading",{name:"Refer a buyer to us and earn up to ₦2M"}).first().waitFor({timeout:8000});
    await splash.waitFor({state:"detached",timeout:1500});const elapsed=Date.now()-started;assert.ok(elapsed>=3000&&elapsed<=8500,`Splash elapsed ${elapsed}ms at ${profile.width}x${profile.height}`);
    const hero=page.getByLabel("Customer viewing a successful Beryl Shelter referral payment notification").first(),headline=page.getByRole("heading",{name:"Refer a buyer to us and earn up to ₦2M"}).first();
    const heroBox=await hero.boundingBox(),headlineBox=await headline.boundingBox();assert.ok(heroBox&&headlineBox);assert.ok(heroBox.height<=Math.min(profile.height*0.34,302));assert.ok(heroBox.width<=342);assert.ok(headlineBox.y>=heroBox.y+heroBox.height-1);
    for(const label of ["Log in","Get started","Refer and earn","Track a referral"]){const box=await page.getByText(label,{exact:true}).last().boundingBox();assert.ok(box,`${label} missing at ${profile.width}x${profile.height}`);assert.ok(box.y+box.height<=profile.height,`${label} clipped at ${profile.width}x${profile.height}`);}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Horizontal overflow at ${profile.width}x${profile.height}`);assert.deepEqual(errors,[]);
    if(profile.width===390){
      const scroller=page.getByLabel("Beryl Shelter introduction");
      assert.equal(await scroller.evaluate(element=>element.scrollWidth),profile.width*4);
      await page.getByLabel("Slide 2 of 3").waitFor({timeout:5000});
      assert.equal(await scroller.evaluate(element=>Math.round(element.scrollLeft)),profile.width);
      const box=await scroller.boundingBox();assert.ok(box);
      const session=await context.newCDPSession(page);
      await session.send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:1});
      const y=Math.round(box.y+box.height/2),start=Math.round(box.x+box.width*0.85);
      await session.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:start,y}]});
      for(let step=1;step<=6;step++){
        await session.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:start-step*46,y}]});
        await page.waitForTimeout(25);
      }
      await session.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
      await page.getByLabel("Slide 3 of 3").waitFor({timeout:3000});
      assert.equal(await scroller.evaluate(element=>Math.round(element.scrollLeft)),profile.width*2);
      await page.waitForTimeout(1800);
      assert.equal(await page.getByLabel("Slide 3 of 3").count(),1,"Auto timer fired before a full idle interval after manual swipe");
      await page.getByLabel("Slide 1 of 3").waitFor({timeout:3000});
      assert.equal(await scroller.evaluate(element=>Math.round(element.scrollLeft)),0,"Final slide did not wrap invisibly to the first slide");
      await session.detach();
    }
    await context.close();
  }
  console.log("Onboarding UI: bounded splash and contained hero/CTA/footer layout passed at 320x640, 360x800, 390x853 and 430x900");
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
