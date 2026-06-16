import { Request } from "express";
import { AppError } from "./AppError";

export const getAuthUserId = (req: Request): string => {
  if (!req.user?.id) {
    throw new AppError("Authentication required", 401);
  }

  return req.user.id;
};