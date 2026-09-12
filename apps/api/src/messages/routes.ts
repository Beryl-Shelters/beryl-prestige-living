import { Router, type Request, type Response, type NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { AuthConfig } from "../auth/config.js";
import type { AuthGateway } from "../auth/gateway.js";
import { AuthSessions } from "../auth/sessions.js";
import { AuthError, expired } from "../auth/errors.js";
import { createTicketInput, replyInput, readInput, ticketQuery } from "./model.js";
import type { TicketsRepository } from "./repository.js";

const wrap = (fn: (req:Request,res:Response)=>Promise<void>) => (req:Request,res:Response,next:NextFunction) => { void fn(req,res).catch(next); };
export function messagesRouter(config:AuthConfig,gateway:AuthGateway,repository:TicketsRepository) {
  const router=Router(); const sessions=new AuthSessions(config,gateway);
  router.use((req,res,next) => {
    res.setHeader("Cache-Control","no-store"); res.vary("Cookie");
    if (!["GET","HEAD"].includes(req.method) && (req.headers.origin!==config.webOrigin || !req.is("application/json"))) return next(new AuthError(403,"UNTRUSTED_ORIGIN","This request is not permitted."));
    next();
  });
  router.use(rateLimit({windowMs:60000,limit:40,skip:req=>["GET","HEAD"].includes(req.method),standardHeaders:"draft-7",legacyHeaders:false,
    message:{success:false,error:{code:"RATE_LIMITED",message:"Too many requests. Please try again later."}}}));
  router.use((req,res,next) => { void (async () => {
    const tokens=await sessions.account(req); const customer=await gateway.findCustomer("id",tokens.userId);
    if (!customer?.email_verified_at) throw expired(); res.locals.ticketOwner=tokens.userId; next();
  })().catch(next); });
  const owner=(res:Response)=>res.locals.ticketOwner as string;
  const id=(req:Request)=>z.uuid().parse(req.params.ticketId);
  const noQuery=(req:Request)=>{ z.object({}).strict().parse(req.query); };
  router.get("/tickets",wrap(async(req,res)=>{
    z.object({}).strict().parse(req.body ?? {});
    const query=ticketQuery.parse(req.query); res.json({success:true,data:await repository.list(owner(res),query.q)});
  }));
  router.get("/tickets/:ticketId",wrap(async(req,res)=>{
    noQuery(req); z.object({}).strict().parse(req.body ?? {});
    res.json({success:true,data:await repository.detail(owner(res),id(req))});
  }));
  router.post("/tickets",wrap(async(req,res)=>{
    noQuery(req); const input=createTicketInput.parse(req.body);
    res.status(201).json({success:true,data:await repository.create(owner(res),input.subject,input.message)});
  }));
  router.post("/tickets/:ticketId/messages",wrap(async(req,res)=>{
    noQuery(req); const input=replyInput.parse(req.body);
    res.status(201).json({success:true,data:await repository.reply(owner(res),id(req),input.message)});
  }));
  // Separate POST acknowledgement keeps GET read-only and enforces CSRF origin.
  router.post("/tickets/:ticketId/read",wrap(async(req,res)=>{
    noQuery(req); const input=readInput.parse(req.body); await repository.acknowledge(owner(res),id(req),input.throughMessageId);
    res.json({success:true,data:{acknowledged:true}});
  }));
  return router;
}
