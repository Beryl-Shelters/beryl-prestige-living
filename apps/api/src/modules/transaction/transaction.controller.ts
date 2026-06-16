import { Request, Response, NextFunction } from "express";
import { getAuthUserId } from "../../utils/getAuthUserId";
import {
  createTransaction,
  getAdminTransactions,
  getMyTransactions,
  getTransactionById,
  updateTransactionStatus
} from "./transaction.service";

export const createTransactionController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const transaction = await createTransaction(getAuthUserId(req), req.body);

    res.status(201).json({
      success: true,
      message: "Transaction created successfully",
      data: { transaction }
    });
  } catch (error) {
    next(error);
  }
};

export const getMyTransactionsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getMyTransactions(getAuthUserId(req), req.query);

    res.status(200).json({
      success: true,
      message: "Transactions fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getTransactionByIdController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const transaction = await getTransactionById(
      req.params.id,
      getAuthUserId(req)
    );

    res.status(200).json({
      success: true,
      message: "Transaction fetched successfully",
      data: { transaction }
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminTransactionsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getAdminTransactions(req.query);

    res.status(200).json({
      success: true,
      message: "Admin transactions fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const updateTransactionStatusController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const transaction = await updateTransactionStatus(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Transaction status updated successfully",
      data: { transaction }
    });
  } catch (error) {
    next(error);
  }
};