import { Request, Response, NextFunction } from "express";
import { getAuthUserId } from "../../utils/getAuthUserId";
import { supabaseAdmin } from "../../config/supabase";
import {
  generatePropertyReferralLink,
  generateSellerReferralLink,
  getMyReferralList,
  getReferralDashboard,
  trackReferral,
  updateReferralStatus
} from "./referral.service";

const getOptionalUserId = async (req: Request) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.split(" ")[1];

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) return null;

  return data.user.id;
};

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
    const optionalUserId = await getOptionalUserId(req);

    const referral = await trackReferral(req.body, optionalUserId);

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