import { createClient,type Session,type SupabaseClient } from "@supabase/supabase-js";
import type { AuthConfig } from "../auth/config.js";
import { AuthError,expired,unavailable } from "../auth/errors.js";
import type { ProviderTokens } from "../auth/gateway.js";

export interface AdminIdentity{createPending(email:string,fullName:string,provisioningId:string):Promise<string>;deletePending(userId:string):Promise<void>;activate(userId:string,password:string):Promise<void>;login(email:string,password:string):Promise<ProviderTokens>;validate(tokens:ProviderTokens):Promise<void>;refresh(tokens:ProviderTokens):Promise<ProviderTokens>;signOut(tokens:ProviderTokens):Promise<void>;}
function providerTokens(session:Session|null):ProviderTokens{if(!session?.user.email_confirmed_at||!session.expires_at)throw expired();return{userId:session.user.id,accessToken:session.access_token,refreshToken:session.refresh_token,expiresAt:session.expires_at};}
export class SupabaseAdminIdentity implements AdminIdentity{
  private readonly admin:SupabaseClient;private readonly transport:typeof fetch;
  constructor(private readonly config:AuthConfig,transport:typeof fetch=fetch){this.transport=(input,init)=>transport(input,{...init,signal:init?.signal??AbortSignal.timeout(15000)});this.admin=createClient(config.supabaseUrl,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:this.transport}});}
  private client(){return createClient(this.config.supabaseUrl,this.config.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:this.transport}});}
  async createPending(email:string,fullName:string,provisioningId:string){
    const {data,error}=await this.admin.auth.admin.createUser({email,email_confirm:true,ban_duration:"876000h",app_metadata:{account_domain:"ADMIN_INVITED"},user_metadata:{full_name:fullName,admin_provisioning_id:provisioningId}});
    if(error||!data.user)throw unavailable();
    const userId=data.user.id;
    try{
      const {data:updated,error:updateError}=await this.admin.auth.admin.updateUserById(userId,{ban_duration:"876000h",app_metadata:{account_domain:"ADMIN_INVITED"},user_metadata:{full_name:fullName,admin_provisioning_id:null}});
      if(updateError||updated.user?.app_metadata.account_domain!=="ADMIN_INVITED")throw unavailable();
      return userId;
    }catch(error){
      await this.deletePending(userId).catch(()=>{});
      throw error;
    }
  }
  async deletePending(userId:string){const {error}=await this.admin.auth.admin.deleteUser(userId);if(error&&!([401,403,404].includes(error.status??0)))throw unavailable();}
  async activate(userId:string,password:string){const {error}=await this.admin.auth.admin.updateUserById(userId,{password,ban_duration:"none",app_metadata:{account_domain:"ADMIN"}});if(error?.code==="weak_password")throw new AuthError(400,"WEAK_PASSWORD","The authentication provider rejected this password.");if(error)throw unavailable();}
  async login(email:string,password:string){const {data,error}=await this.client().auth.signInWithPassword({email,password});if(error)throw new AuthError(401,"INVALID_CREDENTIALS","Invalid credentials.");return providerTokens(data.session);}
  async validate(tokens:ProviderTokens){const {data,error}=await this.client().auth.getUser(tokens.accessToken);if(error||data.user?.id!==tokens.userId||data.user.app_metadata.account_domain!=="ADMIN")throw expired();}
  async refresh(tokens:ProviderTokens){const {data,error}=await this.client().auth.refreshSession({refresh_token:tokens.refreshToken});if(error)throw expired();const next=providerTokens(data.session);if(next.userId!==tokens.userId)throw expired();return next;}
  async signOut(tokens:ProviderTokens){const {error}=await this.admin.auth.admin.signOut(tokens.accessToken,"global");if(error&&!([401,403,404].includes(error.status??0)))throw unavailable();}
}
