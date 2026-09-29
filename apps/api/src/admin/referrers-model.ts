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
    paymentState: "OUTSTANDING" | "PAID";
    paymentId: string | null;
    paidAt: string | null;
  }[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
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
