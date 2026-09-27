import { randomUUID } from "node:crypto";
import { parse,serialize } from "cookie";
import type { Request,Response } from "express";
import type { AuthConfig } from "../auth/config.js";
import { AuthCipher,hashToken,randomToken } from "../auth/crypto.js";
import { AuthError,expired } from "../auth/errors.js";
import type { ProviderTokens } from "../auth/gateway.js";
import type { AdminIdentity } from "./identity.js";
import type { AdminRepository,StoredAdminSession } from "./repository.js";

export class AdminSessions{
  private readonly cipher:AuthCipher;private readonly cookieName:string;
  constructor(private readonly config:AuthConfig,private readonly repository:AdminRepository,private readonly identity:AdminIdentity){this.cipher=new AuthCipher(config.encryptionKey);this.cookieName=`${config.cookieSecure?"__Host-":""}beryl_admin`;}
  private raw(request:Request){return parse(request.headers.cookie??"")[this.cookieName];}
  private set(response:Response,value:string,seconds:number){response.append("Set-Cookie",serialize(this.cookieName,value,{httpOnly:true,secure:this.config.cookieSecure,sameSite:this.config.cookieSameSite,path:"/",maxAge:seconds}));}
  clear(response:Response){this.set(response,"",0);}
  private decode(row:StoredAdminSession){const tokens=this.cipher.open<ProviderTokens>(row.encrypted_tokens,"admin-provider-tokens");if(!tokens||tokens.userId!==row.user_id)throw expired();return tokens;}
  async establish(request:Request,response:Response,tokens:ProviderTokens){const old=this.raw(request);if(old)await this.repository.deleteSession(hashToken(old));const raw=randomToken();await this.repository.createSession(hashToken(raw),tokens.userId,this.cipher.seal(tokens,"admin-provider-tokens"),this.config.sessionSeconds);this.set(response,raw,this.config.sessionSeconds);}
  async account(request:Request){const raw=this.raw(request);if(!raw)throw expired();const hash=hashToken(raw);let row=await this.repository.readSession(hash);if(!row)throw expired();let tokens=this.decode(row);if(tokens.expiresAt<=Date.now()/1000+30){const lock=randomUUID();row=await this.repository.claimRefresh(hash,lock);if(!row)throw new AuthError(409,"SESSION_REFRESHING","Your session is refreshing. Please try again.");tokens=this.decode(row);if(tokens.expiresAt<=Date.now()/1000+30)tokens=await this.identity.refresh(tokens);if(!await this.repository.finishRefresh(hash,lock,this.cipher.seal(tokens,"admin-provider-tokens")))throw expired();}await this.identity.validate(tokens);const profile=await this.repository.profile(tokens.userId);if(!profile?.active)throw expired();return profile;}
  async logout(request:Request,response:Response){const raw=this.raw(request);if(raw){const row=await this.repository.readSession(hashToken(raw));if(row){await this.repository.deleteUserSessions(row.user_id);await this.identity.signOut(this.decode(row));}else await this.repository.deleteSession(hashToken(raw));}this.clear(response);}
}
