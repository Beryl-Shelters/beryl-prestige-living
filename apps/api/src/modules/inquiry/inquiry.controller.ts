import { Request, Response, NextFunction } from "express";
import { getAuthUserId } from "../../utils/getAuthUserId";
import {
  createInquiry,
  getInquiryById,
  getMyInquiries,
  getOptionalUserIdFromToken,
  updateInquiryStatus
} from "./inquiry.service";

const getBearerToken = (req: Request) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) return undefined;

  return authHeader.split(" ")[1];
};

export const createInquiryController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = getBearerToken(req);
    const optionalUserId = await getOptionalUserIdFromToken(token);

    const inquiry = await createInquiry(req.body, optionalUserId);

    res.status(201).json({
      success: true,
      message: "Inquiry submitted successfully",
      data: { inquiry }
    });
  } catch (error) {
    next(error);
  }
};

export const getMyInquiriesController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getMyInquiries(getAuthUserId(req), req.query);

    res.status(200).json({
      success: true,
      message: "Inquiries fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getInquiryByIdController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const inquiry = await getInquiryById(
      req.params.id,
      getAuthUserId(req)
    );

    res.status(200).json({
      success: true,
      message: "Inquiry fetched successfully",
      data: { inquiry }
    });
  } catch (error) {
    next(error);
  }
};

export const updateInquiryStatusController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const inquiry = await updateInquiryStatus(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Inquiry status updated successfully",
      data: { inquiry }
    });
  } catch (error) {
    next(error);
  }
};