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
    const started=Date.now();await page.goto(origin,{waitUntil:"networkidle"});const splash=page.getByLabel("BERYL Shelter Nigeria Limited");await splash.waitFor();
    await page.getByRole("heading",{name:"Refer a buyer to us and earn up to ₦2M"}).waitFor({timeout:8000});
    await splash.waitFor({state:"detached",timeout:1500});const elapsed=Date.now()-started;assert.ok(elapsed>=5200&&elapsed<=7600,`Splash elapsed ${elapsed}ms at ${profile.width}x${profile.height}`);
    const hero=page.getByLabel("Customer viewing a successful Beryl Shelter referral payment notification"),headline=page.getByRole("heading",{name:"Refer a buyer to us and earn up to ₦2M"});
    const heroBox=await hero.boundingBox(),headlineBox=await headline.boundingBox();assert.ok(heroBox&&headlineBox);assert.ok(heroBox.height<=Math.min(profile.height*0.34,302));assert.ok(heroBox.width<=342);assert.ok(headlineBox.y>=heroBox.y+heroBox.height-1);
    for(const label of ["Log in","Get started","Refer and earn","Track a referral"]){const box=await page.getByText(label,{exact:true}).last().boundingBox();assert.ok(box,`${label} missing at ${profile.width}x${profile.height}`);assert.ok(box.y+box.height<=profile.height,`${label} clipped at ${profile.width}x${profile.height}`);}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Horizontal overflow at ${profile.width}x${profile.height}`);assert.deepEqual(errors,[]);
    await context.close();
  }
  console.log("Onboarding UI: bounded splash and contained hero/CTA/footer layout passed at 320x640, 360x800, 390x853 and 430x900");
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
