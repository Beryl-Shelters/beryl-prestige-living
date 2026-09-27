import { createClient,type SupabaseClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import { AuthError,unavailable } from "../auth/errors.js";
import type { AdminDepartment,AdminRole,InviteAdminInput } from "./model.js";

export type AdminProfile={userId:string;fullName:string;email:string;phone:string;department:AdminDepartment;role:AdminRole;active:boolean};
export type InvitationRecord={id:string;fullName:string;email:string;phone:string;department:AdminDepartment;role:AdminRole;authUserId:string|null;expiresAt:string};
export type InvitationPreview=Omit<InvitationRecord,"id"|"phone"|"authUserId">;
export type InvitationClaim=Omit<InvitationRecord,"id"|"phone"|"expiresAt">&{authUserId:string};
export type StoredAdminSession={token_hash:string;user_id:string;encrypted_tokens:string;expires_at:string;refresh_lock:string|null};
export interface AdminRepository{
  profile(userId:string):Promise<AdminProfile|null>;reserve(inviter:string,input:InviteAdminInput,hash:string,seconds:number):Promise<InvitationRecord>;provisionIdentity(invitationId:string):Promise<string>;attach(invitationId:string,userId:string):Promise<void>;preview(hash:string):Promise<InvitationPreview>;claim(hash:string,claim:string):Promise<InvitationClaim>;release(hash:string,claim:string):Promise<void>;accept(hash:string,claim:string,userId:string):Promise<AdminProfile>;
  createSession(hash:string,userId:string,tokens:string,seconds:number):Promise<void>;readSession(hash:string):Promise<StoredAdminSession|null>;claimRefresh(hash:string,lock:string):Promise<StoredAdminSession|null>;finishRefresh(hash:string,lock:string,tokens:string):Promise<boolean>;deleteSession(hash:string):Promise<void>;deleteUserSessions(userId:string):Promise<void>;
}
function dbError(error:{code?:string;message?:string}|null):void{if(!error)return;if(error.code==="42501")throw new AuthError(403,"ADMIN_INVITE_FORBIDDEN","Only a Super Admin may invite administrators.");if(error.code==="23505")throw new AuthError(409,"ADMIN_IDENTITY_EXISTS","An account or accepted invitation already uses that email.");if(error.code==="P0002")throw new AuthError(400,"INVALID_OR_EXPIRED_INVITATION","This invitation is invalid, expired, or already used.");if(error.code==="23514")throw new AuthError(400,"INVALID_INVITATION","Check the invitation details.");throw unavailable();}
export class SupabaseAdminRepository implements AdminRepository{
  private readonly db:SupabaseClient;
  constructor(config:AuthConfig,transport:typeof fetch=fetch){this.db=createClient(config.supabaseUrl,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>transport(input,{...init,signal:init?.signal??AbortSignal.timeout(15000)})}});}
  private async one<T>(name:string,args:Record<string,unknown>):Promise<T>{const {data,error}=await this.db.rpc(name,args);dbError(error);return data as T;}
  profile(userId:string){return this.one<AdminProfile|null>("read_admin_profile",{p_user:userId});}
  reserve(inviter:string,input:InviteAdminInput,hash:string,seconds:number){return this.one<InvitationRecord>("reserve_admin_invitation",{p_inviter:inviter,p_full_name:input.fullName,p_email:input.email,p_phone:input.phone,p_department:input.department,p_role:input.role,p_token_hash:hash,p_seconds:seconds});}
  provisionIdentity(invitationId:string){return this.one<string>("reserve_admin_identity_provisioning",{p_invitation:invitationId});}
  async attach(invitationId:string,userId:string){await this.one("attach_admin_invitation_identity",{p_invitation:invitationId,p_user:userId});}
  preview(hash:string){return this.one<InvitationPreview>("preview_admin_invitation",{p_hash:hash});}
  claim(hash:string,claim:string){return this.one<InvitationClaim>("claim_admin_invitation",{p_hash:hash,p_claim:claim});}
  async release(hash:string,claim:string){await this.one("release_admin_invitation_claim",{p_hash:hash,p_claim:claim});}
  accept(hash:string,claim:string,userId:string){return this.one<AdminProfile>("accept_admin_invitation",{p_hash:hash,p_claim:claim,p_user:userId});}
  async createSession(hash:string,userId:string,tokens:string,seconds:number){await this.one("create_admin_auth_session",{p_hash:hash,p_user:userId,p_tokens:tokens,p_seconds:seconds});}
  private async session(name:string,args:Record<string,string>){const value=await this.one<StoredAdminSession[]|null>(name,args);return value?.[0]??null;}
  readSession(hash:string){return this.session("read_admin_auth_session",{p_hash:hash});}
  claimRefresh(hash:string,lock:string){return this.session("claim_admin_auth_refresh",{p_hash:hash,p_lock:lock});}
  finishRefresh(hash:string,lock:string,tokens:string){return this.one<boolean>("finish_admin_auth_refresh",{p_hash:hash,p_lock:lock,p_tokens:tokens});}
  async deleteSession(hash:string){await this.one("delete_admin_auth_session",{p_hash:hash});}
  async deleteUserSessions(userId:string){await this.one("delete_admin_auth_sessions",{p_user:userId});}
}
