import { z } from "zod";

const propertyCode = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9-]+$/).transform(value => value.toUpperCase());
export const adminReferralCodeSchema = z.string().trim().toUpperCase().regex(/^REF-[A-HJ-NP-Z2-9]{6}$/);
export const adminReferralValidationSchema = z.object({
  customerId:z.uuid(), propertyCode, closedAt:z.iso.datetime({ offset:true }),
}).strict();
export const adminCompletedPurchaseSchema = z.object({
  requestId:z.uuid(), customerId:z.uuid(), propertyCode,
  priceMinor:z.number().int().safe().min(1).max(999999999999999),
  closedAt:z.iso.datetime({ offset:true }),
  referralCode:adminReferralCodeSchema.nullable().optional(),
}).strict();
export type AdminCompletedPurchaseInput=z.infer<typeof adminCompletedPurchaseSchema>;
export type AdminReferralValidation={referralCode:string;referralType:"PROPERTY"|"SELLER";referrerName:string;propertyCode:string};
export type AdminCompletedPurchaseResult={
  purchase:{id:string;propertyCode:string;priceMinor:number;closedAt:string};
  attribution:null|{referralCode:string;referralType?:"PROPERTY"|"SELLER";referrerName?:string};
  commission:null|{reference:string;basisMinor:number;rateBps:200;amountMinor:number;earnedAt:string};
};
