import { Request, Response, NextFunction } from "express";
import { getAuthUserId } from "../../utils/getAuthUserId";
import {
  getBankDirectory,
  getCanonicalReferralDashboard,
  getPayoutDetails,
  getReferralContext,
  generatePropertyReferralLink,
  generateSellerReferralLink,
  getMyReferralList,
  getReferralDashboard,
  requestReferralTrackingOtp,
  resolvePublicReferralCode,
  savePayoutDetails,
  submitReferral,
  trackReferral,
  updateReferralStatus,
  verifyReferralTrackingOtp
} from "./referral.service";
import { referralCodeSchema, referralPaginationSchema } from "./referral.validators";

export const getReferralDashboardController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dashboard = await getReferralDashboard(getAuthUserId(req));

    res.status(200).json({
      success: true,
      message: "Referral dashboard fetched successfully",
      data: dashboard
    });
  } catch (error) {
    next(error);
  }
};

export const getMyReferralListController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getMyReferralList(getAuthUserId(req), req.query);

    res.status(200).json({
      success: true,
      message: "Referral list fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const generatePropertyReferralLinkController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await generatePropertyReferralLink(
      getAuthUserId(req),
      req.params.propertyId
    );

    res.status(200).json({
      success: true,
      message: "Property referral link generated successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const generateSellerReferralLinkController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await generateSellerReferralLink(getAuthUserId(req));

    res.status(200).json({
      success: true,
      message: "Seller referral link generated successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const trackReferralController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const referral = await trackReferral(req.body);

    res.status(201).json({
      success: true,
      message: "Referral tracked successfully",
      data: { referral }
    });
  } catch (error) {
    next(error);
  }
};

export const updateReferralStatusController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const referral = await updateReferralStatus(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Referral status updated successfully",
      data: { referral }
    });
  } catch (error) {
    next(error);
  }
};

const customerId = (req: Request) => req.user?.id;
const trackingToken = (req: Request) => {
  const value = req.headers["x-referral-tracking-token"];
  return typeof value === "string" ? value : undefined;
};

export const getReferralContextController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ success: true, message: "Referral context fetched successfully", data: await getReferralContext(customerId(req)) });
  } catch (error) { next(error); }
};

export const resolveReferralCodeController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = referralCodeSchema.parse(req.params.code);
    res.status(200).json({ success: true, message: "Referral link is valid", data: await resolvePublicReferralCode(code) });
  } catch (error) { next(error); }
};

export const submitReferralController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json({ success: true, message: "Referral submitted successfully", data: await submitReferral(req.body, customerId(req)) });
  } catch (error) { next(error); }
};

export const requestReferralTrackingController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await requestReferralTrackingOtp(req.body.fullName, req.body.phone);
    res.status(202).json({ success: true, message: "If the details match, a tracking code will be sent", data });
  } catch (error) { next(error); }
};

export const verifyReferralTrackingController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ success: true, message: "Referral tracking verified", data: await verifyReferralTrackingOtp(req.body.phone, req.body.otp) });
  } catch (error) { next(error); }
};

export const getCanonicalReferralDashboardController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = referralPaginationSchema.parse(req.query);
    const data = await getCanonicalReferralDashboard(customerId(req), trackingToken(req), pagination.page, pagination.limit);
    res.status(200).json({ success: true, message: "Referral dashboard fetched successfully", data });
  } catch (error) { next(error); }
};

export const getBankDirectoryController = (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: "Referral bank directory fetched successfully", data: getBankDirectory() });
};

export const getPayoutDetailsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ success: true, message: "Payout details fetched successfully", data: await getPayoutDetails(customerId(req), trackingToken(req)) });
  } catch (error) { next(error); }
};

export const savePayoutDetailsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ success: true, message: "Payout details saved successfully", data: await savePayoutDetails(req.body, customerId(req), trackingToken(req)) });
  } catch (error) { next(error); }
};
