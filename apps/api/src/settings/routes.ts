import { Router,type NextFunction,type Request,type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { AuthConfig } from "../auth/config.js";
import { AuthError,expired } from "../auth/errors.js";
import type { AuthGateway,Customer } from "../auth/gateway.js";
import { AuthSessions } from "../auth/sessions.js";
import { changePasswordSchema } from "../auth/validation.js";
import type { MediaStorage } from "../listings/media.js";
import { settingsBusinessInput,settingsProfileInput } from "./model.js";
import type { SettingsRepository } from "./repository.js";
import { BusinessSettingsService,SettingsService } from "./service.js";
import { readBusinessLogoUpload,readProfileUpload } from "./uploads.js";

const wrap=(fn:(req:Request,res:Response)=>Promise<void>)=>(req:Request,res:Response,next:NextFunction)=>{void fn(req,res).catch(next);};
export function settingsRouter(config:AuthConfig,gateway:AuthGateway,repository:SettingsRepository,storage:MediaStorage){
  const router=Router(),sessions=new AuthSessions(config,gateway),service=new SettingsService(repository,storage),businessService=new BusinessSettingsService(repository,storage);
  const passwordLimit=rateLimit({windowMs:60000,limit:5,standardHeaders:"draft-7",legacyHeaders:false,
    message:{success:false,error:{code:"RATE_LIMITED",message:"Too many password attempts. Please try again later."}}});
  router.use((req,res,next)=>{
    res.setHeader("Cache-Control","no-store");res.vary("Cookie");
    if(req.method!=="GET"&&(req.headers.origin!==config.webOrigin||!(req.is("application/json")||req.is("multipart/form-data"))))
      return next(new AuthError(403,"UNTRUSTED_ORIGIN","This request is not permitted."));
    next();
  });
  router.use(rateLimit({windowMs:60000,limit:30,skip:req=>req.method==="GET",standardHeaders:"draft-7",legacyHeaders:false,
    message:{success:false,error:{code:"RATE_LIMITED",message:"Too many requests. Please try again later."}}}));
  router.use((req,res,next)=>{void(async()=>{
    const tokens=await sessions.account(req),customer=await gateway.findCustomer("id",tokens.userId);
    if(!customer?.email_verified_at)throw expired();
    res.locals.settingsCustomer=customer;next();
  })().catch(next);});
  const customer=(res:Response)=>res.locals.settingsCustomer as Customer;
  router.get("/profile",wrap(async(req,res)=>{
    z.object({}).strict().parse(req.query);
    res.json({success:true,data:await repository.read(customer(res).id)});
  }));
  router.patch("/profile",wrap(async(req,res)=>{
    z.object({}).strict().parse(req.query);
    const owner=customer(res);
    if(req.is("multipart/form-data")){
      const upload=await readProfileUpload(req);
      res.json({success:true,data:await service.update(owner.id,owner.country_code,settingsProfileInput.parse(upload.data),upload.file)});
      return;
    }
    res.json({success:true,data:await service.update(owner.id,owner.country_code,settingsProfileInput.parse(req.body))});
  }));
  router.get("/business",wrap(async(req,res)=>{z.object({}).strict().parse(req.query);res.json({success:true,data:await repository.readBusiness(customer(res).id)});}));
  router.patch("/business",wrap(async(req,res)=>{
    z.object({}).strict().parse(req.query);const owner=customer(res);
    if(req.is("multipart/form-data")){const upload=await readBusinessLogoUpload(req);res.json({success:true,data:await businessService.update(owner.id,settingsBusinessInput.parse(upload.data),upload.file)});return;}
    res.json({success:true,data:await businessService.update(owner.id,settingsBusinessInput.parse(req.body))});
  }));
  router.patch("/password",passwordLimit,wrap(async(req,res)=>{
    z.object({}).strict().parse(req.query);
    if(!req.is("application/json"))throw new AuthError(403,"UNTRUSTED_ORIGIN","This request is not permitted.");
    const owner=customer(res),{oldPassword,newPassword}=changePasswordSchema.parse(req.body);
    const verified=await gateway.login(owner.email,oldPassword);
    if(verified.userId!==owner.id)throw new AuthError(401,"INVALID_CREDENTIALS","Invalid credentials.");
    sessions.clear(res,"ACCOUNT");
    await gateway.deleteUserSessions(owner.id);
    await gateway.updatePassword(verified,newPassword);
    await gateway.deleteUserSessions(owner.id);
    await gateway.signOut(verified);
    res.json({success:true,data:{reauthenticate:true}});
  }));
  return router;
}
