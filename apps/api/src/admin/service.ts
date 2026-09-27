import { randomUUID } from "node:crypto";
import { hashToken,randomToken } from "../auth/crypto.js";
import type { AdminConfig } from "./config.js";
import type { AdminInvitationEmail } from "./email.js";
import type { AdminIdentity } from "./identity.js";
import type { InviteAdminInput } from "./model.js";
import type { AdminRepository } from "./repository.js";

export class AdminInvitationService{
  constructor(private readonly config:AdminConfig,private readonly repository:AdminRepository,private readonly identity:AdminIdentity,private readonly email:AdminInvitationEmail){}
  async invite(inviter:string,input:InviteAdminInput){const token=randomToken(),hash=hashToken(token),reservation=await this.repository.reserve(inviter,input,hash,this.config.inviteSeconds);let created:string|undefined;try{if(!reservation.authUserId){const provisioningId=await this.repository.provisionIdentity(reservation.id);created=await this.identity.createPending(reservation.email,reservation.fullName,provisioningId);await this.repository.attach(reservation.id,created);}await this.email.send({fullName:reservation.fullName,email:reservation.email,token,expiresAt:reservation.expiresAt});return{fullName:reservation.fullName,email:reservation.email,expiresAt:reservation.expiresAt};}catch(error){if(created)await this.identity.deletePending(created).catch(()=>{});throw error;}}
  preview(token:string){return this.repository.preview(hashToken(token));}
  async accept(token:string,password:string){const hash=hashToken(token),claim=randomUUID(),invitation=await this.repository.claim(hash,claim);try{await this.identity.activate(invitation.authUserId,password);return await this.repository.accept(hash,claim,invitation.authUserId);}catch(error){await this.repository.release(hash,claim).catch(()=>{});throw error;}}
}
