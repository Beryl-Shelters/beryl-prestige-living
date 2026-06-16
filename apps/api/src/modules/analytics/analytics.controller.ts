import { Request, Response, NextFunction } from "express";
import { AppError } from "../../utils/AppError";
import {
  getAdminDashboardAnalytics,
  getMyPropertyAnalytics,
  getOptionalUserFromToken,
  getPropertyStats,
  trackPropertyShare,
  trackPropertyView
} from "./analytics.service";

const getAuthUserId = (req: Request): string => {
  if (!req.user?.id) {
    throw new AppError("Authentication required", 401);
  }

  return req.user.id;
};

export const trackPropertyViewController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let viewerId: string | null = null;

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : undefined;

    const user = await getOptionalUserFromToken(token);

    if (user?.id) {
      viewerId = user.id;
    }

    const result = await trackPropertyView({
      propertyId: req.params.id,
      viewerId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.status(200).json({
      success: true,
      message: "View tracked successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const trackPropertyShareController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await trackPropertyShare(req.params.id);

    res.status(200).json({
      success: true,
      message: "Share tracked successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getPropertyStatsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getPropertyStats(
      req.params.id,
      getAuthUserId(req)
    );

    res.status(200).json({
      success: true,
      message: "Property stats fetched successfully",
      data: { stats: result }
    });
  } catch (error) {
    next(error);
  }
};

export const getMyPropertyAnalyticsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getMyPropertyAnalytics(
      getAuthUserId(req),
      req.query
    );

    res.status(200).json({
      success: true,
      message: "My property analytics fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminDashboardAnalyticsController = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getAdminDashboardAnalytics();

    res.status(200).json({
      success: true,
      message: "Admin dashboard analytics fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};