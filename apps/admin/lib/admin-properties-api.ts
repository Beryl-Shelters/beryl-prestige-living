import { adminApi } from "./api";

export type PropertyStatus = "UNLISTED" | "PENDING" | "LISTED" | "REJECTED";
export type PropertyDirectoryStatus = "ALL" | PropertyStatus;
export type PropertySort = "NEWEST" | "OLDEST" | "TITLE_ASC" | "TITLE_DESC";
export type PropertyDirectoryItem = {
  id:string;code:string;title:string;propertyType:string;propertySubtype:string;city:string;state:string;
  status:PropertyStatus;createdAt:string;updatedAt:string;submittedAt:string|null;listedAt:string|null;
  sellerId:string;sellerName:string;thumbnailUrl:string|null;hasMandate:boolean;
};
export type PropertyDirectoryPage = {
  counts:{all:number;unlisted:number;pending:number;approved:number;rejected:number};
  items:PropertyDirectoryItem[];page:number;pageSize:number;total:number;totalPages:number;
};
export type PropertyDocument = {id:string;title:string;sortOrder:number;mimeType:string;sizeBytes:number;documentType?:string;description?:string};
export type PropertyReview = {id:string;action:"APPROVED"|"REJECTED";reason:string|null;submissionRequestedAt:string|null;reviewedAt:string;reviewer:{id:string;name:string}};
export type PropertyDetail = {
  id:string;code:string;version:number;title:string;description:string;occupancyType:string;ownershipType:string;
  propertyType:string;propertySubtype:string;hasLien:boolean;bedrooms:number;bathrooms:number;toilets:number|null;
  parkingSpaces:number;units:number|null;landArea:number|null;yearBuilt:number|null;facilities:string[];
  priceMinor:number;minimumDownPaymentMinor:number;location:string;state:string;city:string;
  registeredTitleDocument:string|null;additionalInformation:string|null;status:PropertyStatus;createdAt:string;
  updatedAt:string;submittedAt:string|null;listedAt:string|null;rejectionReason:string|null;rejectedAt:string|null;
  seller:{id:string;name:string;email:string;phone:string|null};
  images:{id:string;url:string;sortOrder:number;mimeType:string;sizeBytes:number}[];
  documents:PropertyDocument[];
  mandate:null|{id:string;type:"Exclusive";commissionPercent:5;signerName:string;mandateDate:string;signedAt:string;submittedAt:string|null;hasSignature:boolean;documents:PropertyDocument[]};
  reviews:PropertyReview[];
};

export function listAdminProperties(query:{search:string;status:PropertyDirectoryStatus;sort:PropertySort;page:number},signal?:AbortSignal){
  const params=new URLSearchParams({search:query.search,status:query.status,sort:query.sort,page:String(query.page),pageSize:"6"});
  return adminApi<PropertyDirectoryPage>(`/properties?${params}`,signal?{signal}:undefined);
}
export async function getAdminProperty(code:string,signal?:AbortSignal){
  const value=await adminApi<{property:PropertyDetail}>(`/properties/${encodeURIComponent(code)}`,signal?{signal}:undefined);return value.property;
}
export async function approveAdminProperty(code:string,version:number){
  const value=await adminApi<{property:PropertyDetail}>(`/properties/${encodeURIComponent(code)}/approve`,{method:"POST",body:JSON.stringify({version})});return value.property;
}
export async function rejectAdminProperty(code:string,version:number,reason:string){
  const value=await adminApi<{property:PropertyDetail}>(`/properties/${encodeURIComponent(code)}/reject`,{method:"POST",body:JSON.stringify({version,reason})});return value.property;
}
export function adminPropertyDocumentUrl(code:string,id:string,mandate=false){
  const apiBase=(process.env.NEXT_PUBLIC_API_BASE_URL??"http://localhost:4000").replace(/\/$/,"");
  return `${apiBase}/api/v1/admin/properties/${encodeURIComponent(code)}/${mandate?"mandate/documents":"documents"}/${encodeURIComponent(id)}`;
}
export function adminMandateSignatureUrl(code:string){
  const apiBase=(process.env.NEXT_PUBLIC_API_BASE_URL??"http://localhost:4000").replace(/\/$/,"");
  return `${apiBase}/api/v1/admin/properties/${encodeURIComponent(code)}/mandate/signature`;
}
