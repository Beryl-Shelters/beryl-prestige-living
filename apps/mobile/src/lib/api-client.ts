import { apiBaseUrl } from "./config";
import { errorKind, MobileApiError } from "./api-error";
import { secureSessionStore, type SessionPurpose, type SessionStore } from "./session-store";
import { shouldClearAccountForResponse } from "./api-auth-boundary";

const responseHeaders: Record<SessionPurpose, string> = { account:"x-beryl-account-token",verify:"x-beryl-verify-token",forgot:"x-beryl-forgot-token",recovery:"x-beryl-recovery-token",oauth:"x-beryl-oauth-token" };
const requestHeaders: Partial<Record<SessionPurpose, string>> = { verify:"X-Beryl-Verify-Token",forgot:"X-Beryl-Forgot-Token",recovery:"X-Beryl-Recovery-Token",oauth:"X-Beryl-OAuth-Token" };
let unauthorizedHandler: (() => Promise<void> | void) | undefined;
export const setUnauthorizedHandler = (handler: (() => Promise<void> | void) | undefined) => { unauthorizedHandler = handler; };

type RequestOptions = Omit<RequestInit,"body"|"headers"> & { body?: unknown; authenticated?: boolean; purposes?: SessionPurpose[]; headers?: Record<string,string> };
type Envelope<T> = { success: true; data: T } | { success: false; error?: { code?: string; message?: string } };

export class MobileApiClient {
  constructor(private readonly store: SessionStore = secureSessionStore, private readonly transport: typeof fetch = fetch) {}
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string,string> = { Accept:"application/json", "X-Beryl-Client":"mobile", ...options.headers };
    if (options.body !== undefined && !(options.body instanceof FormData)) headers["Content-Type"]="application/json";
    if (options.authenticated !== false) { const token=await this.store.get("account"); if(token)headers.Authorization=`Bearer ${token}`; }
    for(const purpose of options.purposes ?? []){const token=await this.store.get(purpose);const header=requestHeaders[purpose];if(token&&header)headers[header]=token;}
    let response:Response;
    try { const transport=this.transport;response=await transport(`${apiBaseUrl}${path}`,{...options,headers,body:options.body===undefined?undefined:options.body instanceof FormData?options.body:JSON.stringify(options.body)}); }
    catch { throw new MobileApiError("network","You appear to be offline. Check your connection and try again."); }
    for(const purpose of Object.keys(responseHeaders) as SessionPurpose[]){const value=response.headers.get(responseHeaders[purpose]);if(value!==null){if(value)await this.store.set(purpose,value);else await this.store.remove(purpose);}}
    const payload=await response.json().catch(()=>null) as Envelope<T>|null;
    if(!response.ok){if(shouldClearAccountForResponse(response.status,options.authenticated)){await this.store.remove("account");await unauthorizedHandler?.();}const message=payload&&"error" in payload&&payload.error?.message?payload.error.message:"Beryl Shelter could not complete this request.";const code=payload&&"error" in payload?payload.error?.code:undefined;throw new MobileApiError(errorKind(response.status),message,response.status,code);}
    if(!payload||!("success" in payload)||!payload.success)throw new MobileApiError("server","Beryl Shelter returned an invalid response.");
    return payload.data;
  }
}

export const apiClient = new MobileApiClient();
