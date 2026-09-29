import { MobileApiError } from "./api-error";
import type { Customer } from "./auth-api";
import type { SessionStore } from "./session-store";

export type RestoredSession = { status:"signedOut"|"signedIn"|"unavailable";customer:Customer|null };
export async function restoreCustomerSession(store:SessionStore,load:()=>Promise<Customer>):Promise<RestoredSession>{
  if(!await store.get("account"))return {status:"signedOut",customer:null};
  try{return {status:"signedIn",customer:await load()};}catch(error){if(error instanceof MobileApiError&&error.kind!=="network"){await store.remove("account");return {status:"signedOut",customer:null};}return {status:"unavailable",customer:null};}
}
export async function clearCustomerSession(store:SessionStore){await store.clear();}
