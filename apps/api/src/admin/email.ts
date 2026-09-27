import { unavailable } from "../auth/errors.js";
import type { AdminConfig } from "./config.js";

export interface AdminInvitationEmail{send(input:{fullName:string;email:string;token:string;expiresAt:string}):Promise<void>;}
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));
export class ResendAdminInvitationEmail implements AdminInvitationEmail{
  constructor(private readonly config:AdminConfig,private readonly transport:typeof fetch=fetch){}
  async send(input:{fullName:string;email:string;token:string;expiresAt:string}){const link=`${this.config.appOrigin}/accept-invitation#token=${encodeURIComponent(input.token)}`,expires=new Date(input.expiresAt).toUTCString();const response=await this.transport("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${this.config.resendApiKey}`,"Content-Type":"application/json"},body:JSON.stringify({from:this.config.inviteFrom,to:[input.email],subject:"Set up your Beryl Shelter Admin account",html:`<div style="font-family:Arial,sans-serif;color:#21170e"><h1>Beryl Shelter</h1><p>Hello ${escapeHtml(input.fullName)},</p><p>You have been invited to the Beryl Shelter Admin system.</p><p><a href="${escapeHtml(link)}">Set up your Admin account</a></p><p>This secure link expires ${escapeHtml(expires)}. If you did not expect this invitation, ignore this email.</p></div>`}),signal:AbortSignal.timeout(15000)});if(!response.ok)throw unavailable();}
}
