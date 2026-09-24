import { AuthApiError } from "./auth-api";
export type ListingStatus = "UNLISTED" | "PENDING" | "LISTED" | "REJECTED";
export type Listing = {
  id:string; listing_code:string; title:string; description:string; occupancy_type:string; ownership_type:string; property_type:string; property_subtype:string;
  has_lien:boolean; bedrooms:number; bathrooms:number; parking_spaces:number; toilet_count:number|null; units:number|null; land_area:number|null; year_built:number|null; facilities:string[];
  property_cost_minor:number; minimum_down_payment_minor:number; location:string; state:string; city:string; longitude:number|null; latitude:number|null;
  listing_status:ListingStatus; property_status:"AVAILABLE"; version:number; created_at:string; updated_at:string; listed_at:string|null; requested_at?:string|null;
  completeness:number; leads:number; views:number; time_on_market:number|null; referral_url:string;
  images:{id:string;url:string;sort_order:number}[];
  documents:{id:string;batch_id:string;title:string;document_type:string;description:string;sort_order:number}[];
  registered_title_document?:string|null;
  additional_information?:string|null;
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

export type MandateDocument = {
  id: string;
  title: string;
  mime_type: string;
  size_bytes: number;
  sort_order: number;
};

export type MandateDocumentUpload = {
  upload_id: string;
  title: string;
  mime_type: string;
  size_bytes: number;
};

export type MandateContent = {
  seller_title: string;
  surname: string;
  first_names: string;
  gender: string;
  email: string;
  telephone: string;
  date_of_birth: string;
  nationality: string;
  post_code: string;
  address: string;
  property_development_name: string;
  document_title: string;
  signer_name: string;
  signer_address: string;
  signer_email: string;
  mandate_date: string;
  agreed_to_mandate: boolean;
};

export type SalesMandate = MandateContent & {
  id: string;
  listing_id: string;
  has_signature: boolean;
  signature_mime_type: "image/png";
  signature_size_bytes: number;
  signed_at: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  documents: MandateDocument[];
};

export type MandatePayload = {
  content: MandateContent;
  signature: { kind: "existing" } | { kind: "upload"; upload_id: string };
  documents: ({ kind: "existing"; id: string } | { kind: "upload"; upload_id: string; title: string })[];
};

export async function getMandate(listingId: string): Promise<SalesMandate | null> {
  try {
    return await listingsRequest<SalesMandate>(`/${listingId}/mandate`);
  } catch (error) {
    if (error instanceof AuthApiError && (error.status === 404 || error.code === "LISTING_NOT_FOUND")) {
      return null;
    }
    throw error;
  }
}

export async function uploadMandateDocuments(
  listingId: string,
  files: File[],
  titles: string[]
): Promise<MandateDocumentUpload[]> {
  const formData = new FormData();
  formData.set("data", JSON.stringify(titles));
  for (const file of files) {
    formData.append("documents", file);
  }
  return listingsRequest<MandateDocumentUpload[]>(`/${listingId}/mandate/documents`, {
    method: "POST",
    body: formData,
  });
}

export async function uploadMandateSignature(
  listingId: string,
  signatureBlob: Blob
): Promise<{
  upload_id: string;
  mime_type: "image/png";
  size_bytes: number;
}> {
  const formData = new FormData();
  formData.append("signature", signatureBlob, "signature.png");
  return listingsRequest<{
    upload_id: string;
    mime_type: "image/png";
    size_bytes: number;
  }>(`/${listingId}/mandate/signature`, {
    method: "POST",
    body: formData,
  });
}

export async function saveMandate(
  listingId: string,
  payload: MandatePayload
): Promise<SalesMandate> {
  return listingsRequest<SalesMandate>(`/${listingId}/mandates`, {
    method: "POST",
    body: payload,
  });
}

export async function submitListing(listingId: string): Promise<Listing> {
  return listingsRequest<Listing>(`/${listingId}/submit`, {
    method: "POST",
    body: {},
  });
}
