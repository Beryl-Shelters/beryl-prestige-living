import { z } from "zod";

export const referralCommissionBasisPoints = 200;
export const referralPageSize = 10;
export const referralQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict();
export const createReferralInput = z.object({
  type: z.enum(["PROPERTY","SELLER"]),
  listingId: z.uuid().optional(),
}).strict().refine(value => value.type === "PROPERTY" ? !!value.listingId : value.listingId === undefined, { message:"Check the referral type and property." });
export const createPublicPropertyReferralInput = z.object({ propertyCode: z.string().trim().min(1).max(100) }).strict();

export type ReferralItem = { id:string; referralType:"PROPERTY"|"SELLER"; budget:number|null; buyerEntityType:string|null; ownershipType:string|null; contactMethod:string|null; propertyCode:string|null; earnings:number; status:string };
export type ReferralPage = { program:{commissionRateBasisPoints:number}; summary:{availableBalance:number;totalEarnings:number;referrals:number;propertiesSold:number};items:ReferralItem[];page:number;pageSize:number;total:number;totalPages:number };
export type CreatedReferral = Pick<ReferralItem,"id"|"referralType"|"propertyCode"> & { referralUrl:string };
