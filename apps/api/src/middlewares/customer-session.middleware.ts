import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { supabaseAdmin } from "../config/supabase";
import { AppError } from "../utils/AppError";
import {
  CustomerTokenError,
  verifyCustomerAccessToken
} from "../modules/auth-onboarding/customer-session.tokens";

declare global {
  namespace Express {
    interface Request {
      customerSession?: {
        id: string;
        version: number;
      };
    }
  }
}

const readClaims = (req: Request) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("Authentication token missing", 401);
  }
  if (env.customerAccessTokenSecret.length < 32) {
    throw new AppError(
      "Customer authentication is temporarily unavailable",
      503,
      "CUSTOMER_AUTH_NOT_CONFIGURED"
    );
  }

  try {
    return verifyCustomerAccessToken(
      authHeader.slice("Bearer ".length),
      env.customerAccessTokenSecret
    );
  } catch (error) {
    throw new AppError(
      error instanceof CustomerTokenError && error.reason === "EXPIRED"
        ? "Authentication token has expired"
        : "Invalid authentication token",
      401,
      "INVALID_ACCESS_TOKEN"
    );
  }
};

export const customerLogoutMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const claims = readClaims(req);
    req.user = { id: claims.sub };
    req.customerSession = { id: claims.sid, version: claims.ver };
    next();
  } catch (error) {
    next(error);
  }
};

export const customerSessionMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const claims = readClaims(req);
    const [sessionResult, profileResult] = await Promise.all([
      supabaseAdmin
        .from("customer_sessions")
        .select(
          "id, user_id, session_version, expires_at, revoked_at, replaced_by_session_id"
        )
        .eq("id", claims.sid)
        .eq("user_id", claims.sub)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("session_version, account_status, email_verified_at")
        .eq("id", claims.sub)
        .maybeSingle()
    ]);

    if (sessionResult.error || profileResult.error) {
      throw new AppError(
        "Customer authentication is temporarily unavailable",
        503,
        "CUSTOMER_AUTHORIZATION_UNAVAILABLE"
      );
    }

    const session = sessionResult.data;
    const profile = profileResult.data;
    if (
      !session ||
      !profile ||
      session.revoked_at ||
      session.replaced_by_session_id ||
      new Date(session.expires_at).getTime() <= Date.now() ||
      session.session_version !== profile.session_version ||
      claims.ver !== profile.session_version
    ) {
      throw new AppError(
        "Customer session is no longer active",
        401,
        "SESSION_NOT_FOUND"
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

    req.user = { id: claims.sub };
    req.customerSession = { id: claims.sid, version: claims.ver };
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalCustomerSessionMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.headers.authorization === undefined) {
    next();
    return;
  }

  void customerSessionMiddleware(req, res, next);
};
