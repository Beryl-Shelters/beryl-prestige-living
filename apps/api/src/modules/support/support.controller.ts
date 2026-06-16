import { Request, Response, NextFunction } from "express";
import { getAuthUserId } from "../../utils/getAuthUserId";
import {
  addSupportTicketMessage,
  assignSupportTicket,
  createSupportTicket,
  getAllSupportTickets,
  getMySupportTickets,
  getSupportTicketById,
  updateSupportTicketStatus
} from "./support.service";

export const createSupportTicketController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ticket = await createSupportTicket(getAuthUserId(req), req.body);

    res.status(201).json({
      success: true,
      message: "Support ticket created successfully",
      data: { ticket }
    });
  } catch (error) {
    next(error);
  }
};

export const getMySupportTicketsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getMySupportTickets(getAuthUserId(req), req.query);

    res.status(200).json({
      success: true,
      message: "Support tickets fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getSupportTicketByIdController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ticket = await getSupportTicketById(
      req.params.id,
      getAuthUserId(req)
    );

    res.status(200).json({
      success: true,
      message: "Support ticket fetched successfully",
      data: { ticket }
    });
  } catch (error) {
    next(error);
  }
};

export const addSupportTicketMessageController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const message = await addSupportTicketMessage(
      req.params.id,
      getAuthUserId(req),
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Ticket message sent successfully",
      data: { message }
    });
  } catch (error) {
    next(error);
  }
};

export const updateSupportTicketStatusController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ticket = await updateSupportTicketStatus(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Support ticket status updated successfully",
      data: { ticket }
    });
  } catch (error) {
    next(error);
  }
};

export const getAllSupportTicketsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getAllSupportTickets(req.query);

    res.status(200).json({
      success: true,
      message: "All support tickets fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const assignSupportTicketController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ticket = await assignSupportTicket(
      req.params.id,
      req.body.assigned_to
    );

    res.status(200).json({
      success: true,
      message: "Support ticket assigned successfully",
      data: { ticket }
    });
  } catch (error) {
    next(error);
  }
};