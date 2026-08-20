import { z } from "zod";
const nullableNumber=z.number().finite().nonnegative().nullable().optional();
const amenities=z.array(z.string().max(80)).max(50).optional().transform(v=>v?.map(x=>x.trim()).filter(Boolean).filter((x,i,a)=>a.findIndex(y=>y.toLowerCase()===x.toLowerCase())===i));
export const draftSchema=z.object({title:z.string().trim().min(1).max(180).optional(),description:z.string().trim().max(5000).optional(),propertyCategory:z.enum(["RESIDENTIAL","COMMERCIAL"]).optional(),propertyType:z.string().trim().max(80).optional(),ownershipType:z.enum(["PERSONAL","THIRD_PARTY"]).optional(),publicLocation:z.string().trim().max(200).optional(),fullAddress:z.string().trim().max(500).optional(),askingPrice:z.number().finite().nonnegative().optional(),negotiable:z.boolean().optional(),initialDepositType:z.enum(["AMOUNT","PERCENTAGE"]).nullable().optional(),initialDepositValue:nullableNumber,condition:z.enum(["OFF_PLAN","UNDER_CONSTRUCTION","NEWLY_BUILT","FAIRLY_USED"]).optional(),furnishing:z.enum(["FULLY_FURNISHED","SEMI_FURNISHED","UNFURNISHED"]).nullable().optional(),bedrooms:nullableNumber,bathrooms:nullableNumber,toilets:nullableNumber,parkingSpaces:nullableNumber,numberOfFloors:nullableNumber,parkingCapacity:nullableNumber,amenities,currentStep:z.enum(["PROPERTY_INFORMATION","PHOTOS_DOCUMENTS","SALES_MANDATE","REVIEW"]).optional()}).superRefine((v,c)=>{if(v.initialDepositType===null&&v.initialDepositValue!=null)c.addIssue({code:"custom",message:"Deposit value requires a deposit type",path:["initialDepositValue"]});if(v.initialDepositType==="PERCENTAGE"&&(v.initialDepositValue??0)>100)c.addIssue({code:"custom",message:"Deposit percentage cannot exceed 100",path:["initialDepositValue"]});});
export const draftListSchema=z.object({page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(50).default(10),status:z.enum(["ALL","DRAFT","IN_REVIEW","LIVE","REJECTED"]).default("ALL")});
export const documentMetadataSchema=z.object({documentType:z.enum(["OWNERSHIP_PAPERS","SURVEY_PLAN","DEED","CERTIFICATE_OF_OCCUPANCY","OTHER"]),displayName:z.string().trim().min(1).max(180)});
export const documentUploadSchema=z.object({documentType:z.enum(["OWNERSHIP_PAPERS","SURVEY_PLAN","DEED","CERTIFICATE_OF_OCCUPANCY","OTHER"]),displayName:z.string().trim().min(1).max(180).optional()});
export const salesMandateSchema=z.object({mandateType:z.enum(["EXCLUSIVE","OPEN"]),sellerFullName:z.string().trim().min(2).max(180),ownershipConfirmed:z.boolean(),mandateAccepted:z.boolean()}).strict().superRefine((value,context)=>{if(value.mandateAccepted&&!value.ownershipConfirmed)context.addIssue({code:"custom",message:"Ownership confirmation is required before accepting the mandate",path:["ownershipConfirmed"],params:{errorCode:"MANDATE_OWNERSHIP_CONFIRMATION_REQUIRED"}})});

const optionalQueryText=(max:number)=>z.preprocess(value=>typeof value==="string"&&value.trim()===""?undefined:value,z.string().trim().max(max).regex(/^[\p{L}\p{N}\s'&-]+$/u).optional());
const optionalNumber=z.preprocess(value=>value===""||value===undefined?undefined:value,z.coerce.number().finite().nonnegative().optional());
const propertyTypes=z.preprocess(value=>{
  const values=(Array.isArray(value)?value:[value]).flatMap(item=>typeof item==="string"?item.split(","):[]).map(item=>item.trim().toUpperCase()).filter(Boolean);
  return values.length?Array.from(new Set(values)):undefined;
},z.array(z.string().min(1).max(80).regex(/^[A-Z0-9_-]+$/)).min(1).max(10).optional());
const multiEnum=<T extends readonly [string,...string[]]>(values:T)=>z.preprocess(value=>{
  const items=(Array.isArray(value)?value:[value]).flatMap(item=>typeof item==="string"?item.split(","):[]).map(item=>item.trim().toUpperCase()).filter(Boolean);
  return items.length?Array.from(new Set(items)):undefined;
},z.array(z.enum(values)).min(1).max(values.length).optional());
const conditions=multiEnum(["NEWLY_BUILT","OFF_PLAN","UNDER_CONSTRUCTION","FAIRLY_USED"] as const);
const furnishings=multiEnum(["FULLY_FURNISHED","UNFURNISHED","SEMI_FURNISHED"] as const);
const bedrooms=z.preprocess(value=>value===""||value===undefined?undefined:value,z.union([z.literal("5+"),z.coerce.number().int().min(1).max(4)]).optional());
export const publicMarketplaceSearchSchema=z.object({
  q:optionalQueryText(100),location:optionalQueryText(120),minPrice:optionalNumber,maxPrice:optionalNumber,
  propertyType:propertyTypes,category:z.enum(["RESIDENTIAL","COMMERCIAL"]).optional(),condition:conditions,furnishing:furnishings,
  bedrooms,
  sort:z.enum(["DEFAULT","PRICE_HIGH_TO_LOW","PRICE_LOW_TO_HIGH","BEDS","MOST_RECENT"]).default("DEFAULT"),
  page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(50).default(10)
}).strict().superRefine((value,context)=>{if(value.minPrice!==undefined&&value.maxPrice!==undefined&&value.minPrice>value.maxPrice)context.addIssue({code:"custom",message:"Minimum price cannot exceed maximum price",path:["minPrice"],params:{errorCode:"INVALID_PRICE_RANGE"}})});
export type PublicMarketplaceSearchInput=z.infer<typeof publicMarketplaceSearchSchema>;
export const marketplacePropertyIdSchema=z.string().uuid();
const optionalInterestMessage=z.preprocess(value=>typeof value==="string"&&value.trim()===""?undefined:value,z.string().trim().max(1000).optional());
export const marketplaceInterestSchema=z.object({preferredContactMethod:z.enum(["WHATSAPP","CALL","EMAIL"]),message:optionalInterestMessage}).strict();
export type MarketplaceInterestInput=z.infer<typeof marketplaceInterestSchema>;
