import { AuthApiError } from "./auth-api";
export type ListingStatus = "UNLISTED" | "PENDING" | "LISTED" | "REJECTED";
export type Listing = {
  id:string; listing_code:string; title:string; description:string; occupancy_type:string; ownership_type:string; property_type:string; property_subtype:string;
  has_lien:boolean; bedrooms:number; bathrooms:number; parking_spaces:number; toilet_count:number|null; units:number|null; land_area:number|null; year_built:number|null; facilities:string[];
  property_cost_minor:number; minimum_down_payment_minor:number; location:string; state:string; city:string; longitude:number|null; latitude:number|null;
  listing_status:ListingStatus; property_status:"AVAILABLE"; version:number; created_at:string; updated_at:string; listed_at:string|null;
  completeness:number; leads:number; views:number; time_on_market:number|null; referral_url:string;
  images:{id:string;url:string;sort_order:number}[];
  documents:{id:string;batch_id:string;title:string;document_type:string;description:string;sort_order:number}[];
  owner?:{full_name:string;email:string;phone:string|null};
};
export type ListingsPage = {items:Listing[];page:number;page_size:number;total:number;total_pages:number};
export type ListingOptions = {occupancy_type:string[];ownership_type:string[];property_type:string[];property_subtype:string[];facilities:string[];document_type:string[];state:string[]};
export async function listingsRequest<T>(path:string, options:{method?:string;body?:FormData|object;signal?:AbortSignal}={},attempt=0):Promise<T> {
  const base=process.env.NEXT_PUBLIC_API_BASE_URL;
  if(!base) throw new AuthApiError("LISTINGS_UNAVAILABLE","Listings are temporarily unavailable. Please try again.");
  let response:Response;
  try { response=await fetch(`${base.replace(/\/$/,"")}/api/v1/listings${path}`,{method:options.method??"GET",credentials:"include",cache:"no-store",...(options.signal?{signal:options.signal}:{}),...(options.body?{body:options.body instanceof FormData?options.body:JSON.stringify(options.body),headers:options.body instanceof FormData?{}:{"Content-Type":"application/json"}}:{})}); }
  catch(error) { if(options.signal?.aborted) throw error; throw new AuthApiError("NETWORK_ERROR","Could not connect to Listings. Please try again."); }
  const payload=await response.json().catch(()=>null);
  if(payload?.error?.code==="SESSION_REFRESHING" && attempt<3) {await new Promise(resolve=>setTimeout(resolve,400));return listingsRequest(path,options,attempt+1);}
  if(!response.ok || !payload?.success) throw new AuthApiError(payload?.error?.code??"LISTINGS_UNAVAILABLE",payload?.error?.message??"Listings are temporarily unavailable. Please try again.",response.status);
  return payload.data as T;
}
export function moneyInput(minor:number) { return `${Math.floor(minor/100)}.${String(minor%100).padStart(2,"0")}`; }
export function formatMoney(minor:number,fraction=true) {
  const whole=BigInt(minor)/100n; const cents=String(BigInt(minor)%100n).padStart(2,"0");
  return `₦${whole.toLocaleString("en-NG")}${fraction?`.${cents}`:""}`;
}
export function commaInput(value:string) {const [whole="",fraction]=value.split(".");return whole.replace(/\B(?=(\d{3})+(?!\d))/g,",")+(fraction===undefined?"":`.${fraction}`);}
export function statusLabel(value:string) {return value.charAt(0)+value.slice(1).toLowerCase();}
export function listingDate(value:string|null) {return value?new Date(value).toLocaleDateString("en-GB"):"-";}
