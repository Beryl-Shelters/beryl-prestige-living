import { Router, type Request, type Response, type NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { AuthConfig } from "../auth/config.js";
import type { AuthGateway, Customer } from "../auth/gateway.js";
import { AuthSessions } from "../auth/sessions.js";
import { AuthError, expired } from "../auth/errors.js";
import { listingOptions, listingQuery, presentListing, versionInput } from "./model.js";
import { notFound, type ListingsRepository } from "./repository.js";
import type { MediaStorage } from "./media.js";
import { readUpload } from "./uploads.js";
import { ListingsService } from "./service.js";
const wrap=(fn:(request:Request,response:Response)=>Promise<void>)=>(request:Request,response:Response,next:NextFunction)=>{void fn(request,response).catch(next);};
export function listingsRouter(config:AuthConfig,gateway:AuthGateway,repository:ListingsRepository,storage:MediaStorage) {
  const router=Router(); const sessions=new AuthSessions(config,gateway); const service=new ListingsService(repository,storage);
  router.use((_req,res,next)=>{res.setHeader("Cache-Control","no-store");res.vary("Cookie");next();});
  router.use((req,_res,next)=>{
    if(req.method!=="GET" && (req.headers.origin!==config.webOrigin || !(req.is("application/json") || req.is("multipart/form-data")))) return next(new AuthError(403,"UNTRUSTED_ORIGIN","This request is not permitted."));
    next();
  });
  router.use(rateLimit({windowMs:60000,limit:40,skip:req=>req.method==="GET",standardHeaders:"draft-7",legacyHeaders:false,message:{success:false,error:{code:"RATE_LIMITED",message:"Too many requests. Please try again later."}}}));
  router.use((req,res,next)=>{void (async()=>{const tokens=await sessions.account(req);const customer=await gateway.findCustomer("id",tokens.userId);if(!customer?.email_verified_at) throw expired();res.locals.customer=customer;next();})().catch(next);});
  const customer=(res:Response)=>res.locals.customer as Customer;
  const id=(req:Request)=>z.uuid().parse(req.params.id);
  router.get("/options",(_req,res)=>{res.json({success:true,data:listingOptions});});
  router.get("/",wrap(async(req,res)=>{const query=listingQuery.parse(req.query);const result=await repository.list(customer(res).id,query);res.json({success:true,data:{items:result.items.map(item=>presentListing(item,config.webOrigin)),page:query.page,page_size:query.page_size,total:result.total,total_pages:Math.ceil(result.total/query.page_size)}});}));
  router.post("/",wrap(async(req,res)=>{const {data,files}=await readUpload(req);const listing=await service.save(customer(res).id,null,data,files);res.status(201).json({success:true,data:presentListing(listing,config.webOrigin)});}));
  router.get("/:id",wrap(async(req,res)=>{const owner=customer(res);const listing=await service.own(owner.id,id(req));res.json({success:true,data:{...presentListing(listing,config.webOrigin),owner:{full_name:[owner.first_name,owner.last_name].filter(Boolean).join(" "),email:owner.email,phone:owner.phone_number_normalized??owner.phone_number}}});}));
  router.patch("/:id",wrap(async(req,res)=>{const owner=customer(res).id;const listingId=id(req);await service.own(owner,listingId);const {data,files}=await readUpload(req);const listing=await service.save(owner,listingId,data,files);res.json({success:true,data:presentListing(listing,config.webOrigin)});}));
  router.delete("/:id",wrap(async(req,res)=>{await service.action(customer(res).id,id(req),versionInput.parse(req.body).version,"DELETE");res.json({success:true,data:{deleted:true}});}));
  for(const [path,action] of [["request-approval","REQUEST_APPROVAL"],["unlist","UNLIST"]] as const) router.post(`/:id/${path}`,wrap(async(req,res)=>{const listing=await service.action(customer(res).id,id(req),versionInput.parse(req.body).version,action);res.json({success:true,data:presentListing(listing!,config.webOrigin)});}));
  router.post("/:id/documents",wrap(async(req,res)=>{const owner=customer(res).id;const listingId=id(req);await service.own(owner,listingId);const {data,files}=await readUpload(req,true);res.status(201).json({success:true,data:presentListing(await service.documents(owner,listingId,data,files),config.webOrigin)});}));
  router.get("/:id/documents/:documentId",wrap(async(req,res)=>{const listing=await service.own(customer(res).id,id(req));const document=listing.documents.find(d=>d.id===z.uuid().parse(req.params.documentId));if(!document) throw notFound();const bytes=await storage.download(document);const extension=document.mime_type==="application/pdf"?"pdf":document.mime_type==="image/png"?"png":"jpg";res.setHeader("Content-Type",document.mime_type);res.setHeader("Content-Disposition",`attachment; filename="document-${document.id}.${extension}"`);res.send(Buffer.from(bytes));}));
  return router;
}
