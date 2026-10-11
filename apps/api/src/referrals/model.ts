import { z } from "zod";

export const referralCommissionBasisPoints = 200;
export const referralPageSize = 10;
export const referralQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict();
export const createReferralInput = z.object({
  type: z.enum(["PROPERTY","SELLER"]),
  listingId: z.uuid().optional(),
}).strict().refine(value => value.type === "PROPERTY" ? !!value.listingId : value.listingId === undefined, { message:"Check the referral type and property." });
export const createPublicPropertyReferralInput = z.object({ propertyCode: z.string().trim().min(1).max(100) }).strict();
export type ReferralItem = { id:string; referralType:"PROPERTY"|"SELLER"; saleAmount:number; propertyCode:string; earnings:number; status:"COMPLETED"; completedAt:string; paymentState:"OUTSTANDING"|"PARTIALLY_PAID"|"PAID"; paidMinor:number; paidAt:string|null };
export type ReferralLedgerPage = { summary:{availableBalance?:number;totalEarnings:number;paid?:number;pendingWithdrawals?:number;grossOutstanding?:number;bankComplete?:boolean;referrals:number;propertiesSold:number};items:ReferralItem[];page:number;pageSize:number;total:number;totalPages:number };
export type ReferralPage = { program:{commissionRateBasisPoints:number}; summary:{totalEarned:number;totalPaid:number;unpaidBalance:number;referrals:number;propertiesSold:number};items:ReferralItem[];page:number;pageSize:number;total:number;totalPages:number };
export type CreatedReferral = { id:string; referralType:"PROPERTY"|"SELLER"; propertyCode:string|null; referralUrl:string };
