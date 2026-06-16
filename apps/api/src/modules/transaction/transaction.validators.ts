import { z } from "zod";

export const createTransactionSchema = z.object({
  property_id: z.string().uuid(),
  buyer_id: z.string().uuid(),
  seller_id: z.string().uuid().optional(),
  agent_id: z.string().uuid().optional(),
  referral_id: z.string().uuid().optional(),
  amount: z.number().positive(),
  commission_amount: z.number().nonnegative().optional(),
  referral_commission_amount: z.number().nonnegative().optional(),
  payment_reference: z.string().optional(),
  payment_method: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export const updateTransactionStatusSchema = z.object({
  status: z.enum(["pending", "paid", "failed", "cancelled", "refunded", "closed"]),
  payment_reference: z.string().optional(),
  payment_method: z.string().optional(),
  commission_amount: z.number().nonnegative().optional(),
  referral_commission_amount: z.number().nonnegative().optional(),
  metadata: z.record(z.any()).optional()
});