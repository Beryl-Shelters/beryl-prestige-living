import { z } from "zod";

export const adminReferrerQuerySchema = z
  .object({
    search: z.string().trim().max(100).default(""),
    filter: z.enum(["ALL", "OWED", "PAID"]).default("ALL"),
    sort: z
      .enum(["NEWEST", "OLDEST", "NAME_ASC", "NAME_DESC", "OUTSTANDING_DESC"])
      .default("NEWEST"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(6),
  })
  .strict();
export const adminReferrerIdSchema = z.uuid();
export const adminCommissionIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^COM-[A-HJ-NP-Z2-9]{6}$/);
export const adminPaymentIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^PAY-[A-HJ-NP-Z2-9]{6}$/);
export const adminPaymentRequestSchema = z
  .object({ requestId: z.uuid() })
  .strict();
export const adminWithdrawalIdSchema = z.string().trim().toUpperCase().regex(/^WDR-[A-HJ-NP-Z2-9]{6}$/);
export const adminWithdrawalRejectionSchema = z.object({ reason:z.string().trim().min(1).max(2000).refine(value=>![...value].some(character=>{const code=character.charCodeAt(0);return code===127||(code<32&&code!==10&&code!==13);}),"Reason contains unsupported characters.") }).strict();
export const adminWithdrawalQuerySchema = z.object({
  status: z.enum(["ALL","PENDING","PROCESSING","PAID","REJECTED","CANCELLED"]).default("ALL"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
}).strict();
export const adminReferrerDetailQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
  })
  .strict();
export type AdminReferrerQuery = z.infer<typeof adminReferrerQuerySchema>;
export type BankStatus = "ON_FILE" | "MISSING" | "NOT_NEEDED";
export type AdminReferrerDirectoryPage = {
  summary: {
    referrers: number;
    referrals: number;
    completed: number;
    outstandingMinor: number;
    reservedMinor: number;
    pendingRequests: number;
  };
  counts: { all: number; owed: number; paid: number };
  items: {
    id: string;
    fullName: string;
    phone: string | null;
    referrals: number;
    completed: number;
    earnedMinor: number;
    paidMinor: number;
    outstandingMinor: number;
    reservedMinor: number;
    availableMinor: number;
    pendingRequests: number;
    bankStatus: BankStatus;
  }[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export type AdminReferrerDetail = {
  referrer: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
  };
  summary: {
    referrals: number;
    completed: number;
    earnedMinor: number;
    paidMinor: number;
    outstandingMinor: number;
    reservedMinor: number;
    availableMinor: number;
  };
  bank: {
    status: BankStatus;
    accountName: string | null;
    bankName: string | null;
    maskedAccountNumber: string | null;
  };
  items: {
    commissionId: string;
    referralCode: string;
    referredName: string;
    referralType: "PROPERTY" | "SELLER";
    propertyCode: string;
    earnedAt: string;
    status: "COMPLETED";
    rewardMinor: number;
    paymentState: "OUTSTANDING" | "PARTIALLY_PAID" | "PAID";
    paidMinor: number;
    reservedMinor: number;
    availableMinor: number;
    paymentId: string | null;
    paidAt: string | null;
  }[];
  withdrawals: AdminWithdrawalItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export type WithdrawalStatus="PENDING"|"PROCESSING"|"PAID"|"REJECTED"|"CANCELLED";
export type AdminWithdrawalQuery=z.infer<typeof adminWithdrawalQuerySchema>;
export type AdminWithdrawalQueuePage={items:{id:string;referrerId:string;referrerName:string;referrerEmail:string;amountMinor:number;status:WithdrawalStatus;bankName:string;maskedAccountNumber:string;requestedAt:string;updatedAt:string|null;rejectionReason:string|null;paymentId:string|null}[];page:number;pageSize:number;total:number;totalPages:number};
export type AdminWithdrawalItem={id:string;amountMinor:number;status:WithdrawalStatus;requestedAt:string;processingStartedAt:string|null;paidAt:string|null;rejectedAt:string|null;rejectionReason:string|null;cancelledAt:string|null;maskedAccountNumber:string;bankName:string;paymentId:string|null};
export type AdminPaymentPreview = {
  commissionId: string;
  referrerId: string;
  referrerName: string;
  referralCode: string;
  amountMinor: number;
  accountName: string;
  bankName: string;
  accountNumber: string;
};
export type AdminPaymentResult = {
  paymentId: string;
  commissionId: string;
  referrerId: string;
  amountMinor: number;
  paidAt: string;
};
export type AdminWithdrawalPaymentPreview={withdrawalId:string;referrerId:string;referrerName:string;amountMinor:number;accountName:string;bankName:string;accountNumber:string};
export type AdminWithdrawalPaymentResult={paymentId:string;withdrawalId:string;referrerId:string;amountMinor:number;paidAt:string};
