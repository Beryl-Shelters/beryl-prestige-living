import { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AppError } from "../utils/AppError";

const legacyAdminRoles = new Set(["admin", "support_agent", "super_admin"]);

export const requireVerifiedCustomer = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.id) {
      throw new AppError("Authentication required", 401);
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("account_status, email_verified_at, role")
      .eq("id", req.user.id)
      .maybeSingle();

    if (profileError) {
      throw new AppError(
        "Customer authorization is temporarily unavailable",
        503,
        "CUSTOMER_AUTHORIZATION_UNAVAILABLE"
      );
    }

    if (!profile || legacyAdminRoles.has(profile.role)) {
      throw new AppError(
        "Customer access is required",
        403,
        "CUSTOMER_ACCESS_REQUIRED"
      );
    }

    if (
      profile.account_status === "PENDING_VERIFICATION" ||
      !profile.email_verified_at
    ) {
      throw new AppError(
        "Account verification is required",
        403,
        "ACCOUNT_VERIFICATION_REQUIRED"
      );
    }

    if (profile.account_status === "SUSPENDED") {
      throw new AppError("Account is suspended", 403, "ACCOUNT_SUSPENDED");
    }

    if (profile.account_status === "LOCKED") {
      throw new AppError("Account is locked", 423, "ACCOUNT_LOCKED");
    }

    const { data: customerRecord, error: customerRecordError } =
      await supabaseAdmin
        .from("customer_records")
        .select("id")
        .eq("user_id", req.user.id)
        .maybeSingle();

    if (customerRecordError) {
      throw new AppError(
        "Customer authorization is temporarily unavailable",
        503,
        "CUSTOMER_AUTHORIZATION_UNAVAILABLE"
      );
    }

    if (!customerRecord) {
      throw new AppError(
        "Customer access is required",
        403,
        "CUSTOMER_ACCESS_REQUIRED"
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};
