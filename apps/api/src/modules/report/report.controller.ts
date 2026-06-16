import { Request, Response, NextFunction } from "express";
import { getAuthUserId } from "../../utils/getAuthUserId";
import { supabaseAdmin } from "../../config/supabase";
import {
  adminReports,
  createReport,
  deleteReport,
  getMyReports,
  getReportById,
  reviewReport
} from "./report.service";

const getAuthUserRole = async (userId: string): Promise<string | undefined> => {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  return data?.role;
};

export const createReportController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const report = await createReport(getAuthUserId(req), req.body);

    res.status(201).json({
      success: true,
      message: "Report submitted successfully",
      data: { report }
    });
  } catch (error) {
    next(error);
  }
};

export const getMyReportsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);

    const result = await getMyReports(getAuthUserId(req), page, limit);

    res.status(200).json({
      success: true,
      message: "Reports fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getReportController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getAuthUserId(req);
    const role = await getAuthUserRole(userId);

    const report = await getReportById(req.params.id, userId, role);

    res.status(200).json({
      success: true,
      message: "Report fetched successfully",
      data: { report }
    });
  } catch (error) {
    next(error);
  }
};

export const adminReportsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await adminReports(req.query);

    res.status(200).json({
      success: true,
      message: "Admin reports fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const reviewReportController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const report = await reviewReport(req.params.id, getAuthUserId(req), req.body);

    res.status(200).json({
      success: true,
      message: "Report reviewed successfully",
      data: { report }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteReportController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getAuthUserId(req);
    const role = await getAuthUserRole(userId);

    await deleteReport(req.params.id, userId, role);

    res.status(200).json({
      success: true,
      message: "Report deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};