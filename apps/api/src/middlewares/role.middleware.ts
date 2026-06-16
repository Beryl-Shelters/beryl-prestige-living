import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { supabaseAdmin } from "../config/supabase";

export const requireRoles = (roles: string[]) => {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        return next(
          new AppError("Authentication required", 401)
        );
      }

      const { data: profile, error } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", req.user.id)
        .single();

      if (error || !profile) {
        return next(
          new AppError("Profile not found", 404)
        );
      }

      if (!roles.includes(profile.role)) {
        return next(
          new AppError(
            "You do not have permission to perform this action",
            403
          )
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};