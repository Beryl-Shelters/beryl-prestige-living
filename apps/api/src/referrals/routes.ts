import { Router,type NextFunction,type Request,type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { AuthConfig } from "../auth/config.js";
import { AuthError,expired } from "../auth/errors.js";
import type { AuthGateway } from "../auth/gateway.js";
import { AuthSessions } from "../auth/sessions.js";
import { createReferralInput,referralQuery } from "./model.js";
import type { ReferralsRepository } from "./repository.js";
import { ReferralsService } from "./service.js";

const wrap=(fn:(request:Request,response:Response)=>Promise<void>)=>(request:Request,response:Response,next:NextFunction)=>{void fn(request,response).catch(next);};
export function referralsRouter(config:AuthConfig,gateway:AuthGateway,repository:ReferralsRepository){
  const router=Router(),sessions=new AuthSessions(config,gateway),service=new ReferralsService(config,repository);
  router.use((req,res,next)=>{res.setHeader("Cache-Control","no-store");res.vary("Cookie");if(req.method!=="GET"&&(req.headers.origin!==config.webOrigin||!req.is("application/json")))return next(new AuthError(403,"UNTRUSTED_ORIGIN","This request is not permitted."));next();});
  router.use(rateLimit({windowMs:60000,limit:40,skip:req=>req.method==="GET",standardHeaders:"draft-7",legacyHeaders:false,message:{success:false,error:{code:"RATE_LIMITED",message:"Too many requests. Please try again later."}}}));
  router.use((req,res,next)=>{void(async()=>{const tokens=await sessions.account(req),customer=await gateway.findCustomer("id",tokens.userId);if(!customer?.email_verified_at)throw expired();res.locals.referralOwner=tokens.userId;next();})().catch(next);});
  const owner=(res:Response)=>res.locals.referralOwner as string;
  router.get("/",wrap(async(req,res)=>{if(req.body&&Object.keys(req.body).length)throw new AuthError(400,"INVALID_REFERRAL_QUERY","Use a positive whole-number page.");const query=referralQuery.parse(req.query);res.json({success:true,data:await service.list(owner(res),query.page)});}));
  router.post("/",wrap(async(req,res)=>{if(Object.keys(req.query).length)throw new AuthError(400,"INVALID_REFERRAL","Check the referral details.");const input=createReferralInput.parse(req.body);res.status(201).json({success:true,data:await service.create(owner(res),input.type,input.listingId??null)});}));
  return router;
}
