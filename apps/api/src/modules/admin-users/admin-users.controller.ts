import { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import * as service from "./admin-users.service";
import { adminUserIdSchema, adminUserListSchema } from "./admin-users.validators";

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = adminUserListSchema.safeParse(req.query);
    if (!parsed.success) {
      const invalidSort = parsed.error.issues.some((issue) => issue.path[0] === "sort");
      throw new AppError(invalidSort ? "Invalid user sort" : "Invalid user filter", 400, invalidSort ? "INVALID_USER_SORT" : "INVALID_USER_FILTER");
    }
    res.json({ success: true, message: "Admin users fetched successfully", data: await service.listUsers(parsed.data) });
  } catch (error) { next(error); }
};

export const detail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = adminUserIdSchema.safeParse(req.params.userId);
    if (!parsed.success) throw new AppError("Customer not found", 404, "ADMIN_USER_NOT_FOUND");
    res.json({ success: true, message: "Admin user fetched successfully", data: await service.getUserDetail(parsed.data) });
  } catch (error) { next(error); }
};
