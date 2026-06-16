import { Request, Response, NextFunction } from "express";
import { getAuthUserId } from "../../utils/getAuthUserId";
import {
  getAdminSummary,
  getInvestments,
  getOverview,
  getRecentMessages,
  getRecentProperties
} from "./dashboard.service";

export const overviewController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await getOverview(getAuthUserId(req), "");

    res.status(200).json({
      success: true,
      message: "Dashboard overview fetched successfully",
      data
    });
  } catch (error) {
    next(error);
  }
};

export const investmentsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const period =
      req.query.period === "yearly" ? "yearly" : "monthly";

    const data = await getInvestments(getAuthUserId(req), period);

    res.status(200).json({
      success: true,
      message: "Investment summary fetched successfully",
      data
    });
  } catch (error) {
    next(error);
  }
};

export const recentMessagesController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await getRecentMessages(getAuthUserId(req));

    res.status(200).json({
      success: true,
      message: "Recent messages fetched successfully",
      data
    });
  } catch (error) {
    next(error);
  }
};

export const recentPropertiesController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await getRecentProperties(getAuthUserId(req));

    res.status(200).json({
      success: true,
      message: "Recent properties fetched successfully",
      data
    });
  } catch (error) {
    next(error);
  }
};

export const adminSummaryController = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await getAdminSummary();

    res.status(200).json({
      success: true,
      message: "Admin dashboard summary fetched successfully",
      data
    });
  } catch (error) {
    next(error);
  }
};