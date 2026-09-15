import { Router,type NextFunction,type Request,type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { AuthConfig } from "../auth/config.js";
import { AuthError,expired } from "../auth/errors.js";
import type { AuthGateway } from "../auth/gateway.js";
import { AuthSessions } from "../auth/sessions.js";
import type { MediaStorage } from "../listings/media.js";
import { kycSubmissionInput } from "./model.js";
import type { KycRepository } from "./repository.js";
import { KycService } from "./service.js";
import { readKycUpload } from "./uploads.js";
const wrap=(fn:(req:Request,res:Response)=>Promise<void>)=>(req:Request,res:Response,next:NextFunction)=>{void fn(req,res).catch(next);};
export function kycRouter(config:AuthConfig,gateway:AuthGateway,repository:KycRepository,storage:MediaStorage){const router=Router(),sessions=new AuthSessions(config,gateway),service=new KycService(repository,storage),submitLimit=rateLimit({windowMs:60*60*1000,limit:5,standardHeaders:"draft-7",legacyHeaders:false,message:{success:false,error:{code:"RATE_LIMITED",message:"Too many KYC submission attempts. Please try again later."}}});router.use((req,res,next)=>{res.setHeader("Cache-Control","no-store");res.vary("Cookie");if(req.method!=="GET"&&(req.headers.origin!==config.webOrigin||!req.is("multipart/form-data")))return next(new AuthError(403,"UNTRUSTED_ORIGIN","This request is not permitted."));next();});router.use((req,res,next)=>{void(async()=>{const tokens=await sessions.account(req),customer=await gateway.findCustomer("id",tokens.userId);if(!customer?.email_verified_at)throw expired();res.locals.kycOwner=customer.id;next();})().catch(next);});const owner=(res:Response)=>res.locals.kycOwner as string;router.get("/",wrap(async(req,res)=>{z.object({}).strict().parse(req.query);res.json({success:true,data:await repository.read(owner(res))});}));router.post("/",submitLimit,wrap(async(req,res)=>{z.object({}).strict().parse(req.query);const upload=await readKycUpload(req),input=kycSubmissionInput.parse(upload.data);res.status(201).json({success:true,data:await service.submit(owner(res),input,upload.files)});}));router.get("/documents/:documentId",wrap(async(req,res)=>{z.object({}).strict().parse(req.query);const id=z.uuid().parse(req.params.documentId),{asset,bytes}=await service.download(owner(res),id),extension=asset.mime_type==="application/pdf"?"pdf":asset.mime_type==="image/png"?"png":"jpg";res.setHeader("Content-Type",asset.mime_type);res.setHeader("Content-Disposition",`attachment; filename="kyc-document-${id}.${extension}"`);res.setHeader("X-Content-Type-Options","nosniff");res.send(Buffer.from(bytes));}));return router;}
