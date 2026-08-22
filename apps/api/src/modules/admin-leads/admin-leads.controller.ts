import { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import * as service from "./admin-leads.service";
import { adminLeadListSchema } from "./admin-leads.validators";

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = adminLeadListSchema.safeParse(req.query);
    if (!parsed.success) throw new AppError("Invalid lead search or limit", 400, "INVALID_LEAD_FILTER");
    res.json({ success: true, message: "Admin leads fetched successfully", data: await service.listLeads(parsed.data) });
  } catch (error) { next(error); }
};

export const detail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, message: "Admin lead fetched successfully", data: { lead: await service.getLeadDetail(req.params.leadId) } });
  } catch (error) { next(error); }
};

export const updateStage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, message: "Lead stage updated successfully", data: await service.updateLeadStage(req.params.leadId, req.user!.id, req.body.expectedStage, req.body.stage) });
  } catch (error) { next(error); }
};
