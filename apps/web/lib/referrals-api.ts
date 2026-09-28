import { AuthApiError } from "./auth-api";

export type ReferralItem={id:string;referralType:"PROPERTY"|"SELLER";saleAmount:number;propertyCode:string;earnings:number;status:"COMPLETED";completedAt:string};
export type ReferralPage={program:{commissionRateBasisPoints:number};summary:{availableBalance:number;totalEarnings:number;referrals:number;propertiesSold:number};items:ReferralItem[];page:number;pageSize:number;total:number;totalPages:number};
export type CreatedReferral={id:string;referralType:"PROPERTY"|"SELLER";propertyCode:string|null;referralUrl:string};

const base=()=>{const value=process.env.NEXT_PUBLIC_API_BASE_URL;if(!value)throw new AuthApiError("CONFIGURATION_UNAVAILABLE","Dashboard services are not configured. Please try again later.");return value.replace(/\/$/,"");};
async function parse<T>(response:Response){let payload:{success:boolean;data:T;error?:{code:string;message:string}};try{payload=await response.json();}catch{throw new AuthApiError("INVALID_RESPONSE","Referrals are temporarily unavailable. Please try again.");}if(!response.ok||!payload.success)throw new AuthApiError(payload.error?.code??"REFERRALS_UNAVAILABLE",payload.error?.message??"Referrals are temporarily unavailable. Please try again.",response.status);return payload.data;}
export async function fetchReferrals(page:number,signal:AbortSignal,refreshAttempts=0):Promise<ReferralPage>{
  let response:Response;try{response=await fetch(`${base()}/api/v1/dashboard/referrals?${new URLSearchParams({page:String(page)})}`,{credentials:"include",cache:"no-store",signal});}catch(error){if(signal.aborted)throw error;throw new AuthApiError("NETWORK_ERROR","Could not connect to dashboard services. Please try again.");}
  if(response.status===409&&refreshAttempts<3){await new Promise(resolve=>setTimeout(resolve,400));if(signal.aborted)throw new DOMException("Aborted","AbortError");return fetchReferrals(page,signal,refreshAttempts+1);}
  return parse<ReferralPage>(response);
}
export async function createReferral(input:{type:"SELLER"}|{type:"PROPERTY";listingId:string},signal?:AbortSignal):Promise<CreatedReferral>{
  let response:Response;try{response=await fetch(`${base()}/api/v1/dashboard/referrals`,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify(input),...(signal?{signal}:{})});}catch(error){if(signal?.aborted)throw error;throw new AuthApiError("NETWORK_ERROR","Could not connect to referral services. Please try again.");}return parse<CreatedReferral>(response);
}
export async function createPublicPropertyReferral(propertyCode:string,signal?:AbortSignal):Promise<CreatedReferral>{
  let response:Response;try{response=await fetch(`${base()}/api/v1/dashboard/referrals/public-property`,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({propertyCode}),...(signal?{signal}:{})});}catch(error){if(signal?.aborted)throw error;throw new AuthApiError("NETWORK_ERROR","Could not connect to referral services. Please try again.");}return parse<CreatedReferral>(response);
}
