import { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import * as service from "./admin-referrers.service";
import { adminReferralIdSchema, adminReferrerIdSchema, adminReferrerListSchema } from "./admin-referrers.validators";

const id = (value: string, kind: "referrer" | "referral") => {
  const parsed = (kind === "referrer" ? adminReferrerIdSchema : adminReferralIdSchema).safeParse(value);
  if (!parsed.success) throw new AppError(kind === "referrer" ? "Referrer not found" : "Referral not found", 404, kind === "referrer" ? "REFERRER_NOT_FOUND" : "REFERRAL_NOT_FOUND");
  return parsed.data;
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = adminReferrerListSchema.safeParse(req.query);
    if (!parsed.success) throw new AppError("Invalid referrer directory filters", 400, "INVALID_REFERRER_FILTER");
    res.json({ success: true, message: "Admin referrers fetched successfully", data: await service.listReferrers(parsed.data) });
  } catch (error) { next(error); }
};

export const detail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, message: "Admin referrer fetched successfully", data: { referrer: await service.getReferrerDetail(id(req.params.referrerId, "referrer")) } });
  } catch (error) { next(error); }
};

export const paymentPreparation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader("Cache-Control", "no-store, private");
    res.json({ success: true, message: "Payment details prepared", data: { payment: await service.getPaymentPreparation(id(req.params.referrerId, "referrer"), id(req.params.referralId, "referral")) } });
  } catch (error) { next(error); }
};

export const markPaid = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError("Payment receipt is required", 400, "PAYMENT_RECEIPT_REQUIRED");
    res.json({ success: true, message: "Referral payment recorded successfully", data: await service.markReferralPaid(id(req.params.referrerId, "referrer"), id(req.params.referralId, "referral"), req.user!.id, req.file) });
  } catch (error) { next(error); }
};

export const receiptAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader("Cache-Control", "no-store, private");
    res.json({ success: true, message: "Payment receipt access created", data: { access: await service.createReceiptAccess(id(req.params.referrerId, "referrer"), id(req.params.referralId, "referral")) } });
  } catch (error) { next(error); }
};
