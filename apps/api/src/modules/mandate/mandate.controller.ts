import { Request, Response, NextFunction } from "express";
import { getAuthUserId } from "../../utils/getAuthUserId";
import {
  createMandate,
  deleteMandate,
  getAdminMandates,
  getMandateById,
  getMyMandates,
  reviewMandate
} from "./mandate.service";

export const createMandateController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const mandate = await createMandate(
      getAuthUserId(req),
      req.body,
      req.file
    );

    res.status(201).json({
      success: true,
      message: "Mandate submitted successfully",
      data: { mandate }
    });
  } catch (error) {
    next(error);
  }
};

export const getMyMandatesController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getMyMandates(getAuthUserId(req), req.query);

    res.status(200).json({
      success: true,
      message: "Mandates fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getMandateByIdController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const mandate = await getMandateById(
      req.params.id,
      getAuthUserId(req)
    );

    res.status(200).json({
      success: true,
      message: "Mandate fetched successfully",
      data: { mandate }
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminMandatesController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getAdminMandates(req.query);

    res.status(200).json({
      success: true,
      message: "Admin mandates fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const reviewMandateController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const mandate = await reviewMandate(
      req.params.id,
      getAuthUserId(req),
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Mandate reviewed successfully",
      data: { mandate }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMandateController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await deleteMandate(req.params.id, getAuthUserId(req));

    res.status(200).json({
      success: true,
      message: "Mandate deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};