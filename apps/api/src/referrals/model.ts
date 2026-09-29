import { z } from "zod";

export const referralCommissionBasisPoints = 200;
export const referralPageSize = 10;
export const referralQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict();
export const createReferralInput = z.object({
  type: z.enum(["PROPERTY","SELLER"]),
  listingId: z.uuid().optional(),
}).strict().refine(value => value.type === "PROPERTY" ? !!value.listingId : value.listingId === undefined, { message:"Check the referral type and property." });
export const createPublicPropertyReferralInput = z.object({ propertyCode: z.string().trim().min(1).max(100) }).strict();
export const withdrawalQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict();
export const withdrawalId = z.string().trim().toUpperCase().regex(/^WDR-[A-HJ-NP-Z2-9]{6}$/);
export const createWithdrawalInput = z.object({
  requestId: z.uuid(),
  amountMinor: z.number().int().min(1).max(999999999999999),
}).strict();
export const cancelWithdrawalInput = z.object({}).strict();

export type ReferralItem = { id:string; referralType:"PROPERTY"|"SELLER"; saleAmount:number; propertyCode:string; earnings:number; status:"COMPLETED"; completedAt:string; paymentState:"OUTSTANDING"|"PARTIALLY_PAID"|"PAID"; paidMinor:number; paidAt:string|null };
export type ReferralPage = { program:{commissionRateBasisPoints:number}; summary:{availableBalance:number;totalEarnings:number;paid:number;pendingWithdrawals:number;grossOutstanding:number;bankComplete:boolean;referrals:number;propertiesSold:number};items:ReferralItem[];page:number;pageSize:number;total:number;totalPages:number };
export type CreatedReferral = { id:string; referralType:"PROPERTY"|"SELLER"; propertyCode:string|null; referralUrl:string };
export type WithdrawalStatus="PENDING"|"PROCESSING"|"PAID"|"REJECTED"|"CANCELLED";
export type WithdrawalItem={id:string;amountMinor:number;status:WithdrawalStatus;requestedAt:string;processingStartedAt:string|null;paidAt:string|null;rejectedAt:string|null;rejectionReason:string|null;cancelledAt:string|null;paymentId:string|null};
export type WithdrawalPage={balance:{totalEarnedMinor:number;totalPaidMinor:number;grossOutstandingMinor:number;pendingMinor:number;availableMinor:number;minimumMinor:number};bank:{complete:boolean;accountName:string|null;bankName:string|null;maskedAccountNumber:string|null};items:WithdrawalItem[];page:number;pageSize:number;total:number;totalPages:number};
export type CreatedWithdrawal={id:string;amountMinor:number;status:WithdrawalStatus;requestedAt:string};
