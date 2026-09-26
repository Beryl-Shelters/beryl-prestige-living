import { Router, type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { AuthConfig } from "../auth/config.js";
import { AuthError } from "../auth/errors.js";
import { inquirySources, inquiryTypes, type PublicInquiriesRepository } from "./repository.js";

const noControls=(value:string)=>[...value].every(char=>{const point=char.codePointAt(0)!;return point>31&&point!==127});
const messageControls=(value:string)=>[...value].every(char=>{const point=char.codePointAt(0)!;return point>31&&point!==127||point===10||point===13});
const inquirySchema=z.strictObject({
  inquiryType:z.enum(inquiryTypes),name:z.string().trim().min(2).max(120).refine(noControls,"Name contains invalid characters."),
  phone:z.string().trim().min(7).max(25).regex(/^\+?[0-9()\-\s]+$/,"Enter a valid contact number.").refine(noControls),
  email:z.string().trim().email().max(254).transform(value=>value.toLowerCase()),message:z.string().trim().min(2).max(3000).refine(messageControls,"Message contains invalid characters."),
  sourcePage:z.enum(inquirySources),
});
const wrap=(fn:(request:Request,response:Response)=>Promise<void>)=>(request:Request,response:Response,next:NextFunction)=>{void fn(request,response).catch(next)};

export function publicInquiriesRouter(config:AuthConfig,repository:PublicInquiriesRepository){const router=Router();router.use((_req,res,next)=>{res.setHeader("Cache-Control","no-store");next()});
  router.post("/",rateLimit({windowMs:3600000,limit:20,standardHeaders:"draft-7",legacyHeaders:false,message:{success:false,error:{code:"RATE_LIMITED",message:"Too many inquiries. Please try again later."}}}),wrap(async(req,res)=>{
    if(req.headers.origin!==config.webOrigin)throw new AuthError(403,"UNTRUSTED_ORIGIN","This request is not permitted.");
    if(!req.is("application/json"))throw new AuthError(415,"JSON_REQUIRED","Submit the inquiry as JSON.");
    if(Object.keys(req.query).length)throw new AuthError(400,"INVALID_INQUIRY","Check the supplied inquiry fields.");
    const inquiry=inquirySchema.parse(req.body);try{await repository.submit(inquiry)}catch{throw new AuthError(503,"INQUIRY_UNAVAILABLE","Your inquiry could not be submitted. Please try again.")}
    res.status(201).json({success:true,data:{recorded:true}});
  }));return router;}
