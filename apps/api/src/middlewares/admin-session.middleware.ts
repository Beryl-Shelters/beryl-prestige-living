import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { AdminTokenError, verifyAdminAccessToken } from "../modules/admin-auth/admin-session.tokens";
import { SupabaseAdminAuthStore } from "../modules/admin-auth/supabase-admin-auth.store";

declare global {
  namespace Express {
    interface Request {
      adminSession?: { id: string; version: number; restricted: boolean; role: "ADMIN" | "SUPER_ADMIN"; department: "TECH" | "MANAGEMENT" };
    }
  }
}

const store = new SupabaseAdminAuthStore();

export const adminSessionMiddleware = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new AppError("Admin authentication token missing", 401, "ADMIN_ACCESS_REQUIRED");
    if (env.adminAccessTokenSecret.length < 32) throw new AppError("Admin authentication is temporarily unavailable", 503, "ADMIN_AUTH_NOT_CONFIGURED");
    let claims;
    try { claims = verifyAdminAccessToken(header.slice("Bearer ".length), env.adminAccessTokenSecret); }
    catch (error) { throw new AppError(error instanceof AdminTokenError && error.reason === "EXPIRED" ? "Admin authentication token has expired" : "Invalid Admin authentication token", 401, "ADMIN_ACCESS_REQUIRED"); }
    const [session, admin] = await Promise.all([store.getSession(claims.sub, claims.sid), store.findAdminById(claims.sub)]);
    if (!session || !admin || session.revoked_at || session.replaced_by_session_id || new Date(session.expires_at).getTime() <= Date.now() || session.session_version !== admin.session_version || claims.ver !== admin.session_version) throw new AppError("Admin session is no longer active", 401, "ADMIN_SESSION_NOT_FOUND");
    if (admin.status === "PENDING") throw new AppError("Admin account activation is pending", 403, "ADMIN_ACCOUNT_PENDING");
    if (admin.status === "SUSPENDED") throw new AppError("Admin account is suspended", 403, "ADMIN_ACCOUNT_SUSPENDED");
    if (admin.status === "LOCKED") throw new AppError("Admin account is locked", 423, "ADMIN_ACCOUNT_LOCKED");
    req.user = { id: admin.id, email: admin.email };
    req.adminSession = { id: claims.sid, version: claims.ver, restricted: claims.restricted, role: claims.role, department: claims.department };
    next();
  } catch (error) { next(error); }
};

export const requireAdminRole = (...roles: Array<"ADMIN" | "SUPER_ADMIN">) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.adminSession) return next(new AppError("Admin access is required", 401, "ADMIN_ACCESS_REQUIRED"));
  if (!roles.includes(req.adminSession.role)) return next(new AppError("Super Admin access is required", 403, "SUPER_ADMIN_ACCESS_REQUIRED"));
  if (req.adminSession.restricted) return next(new AppError("Admin password change is required", 403, "ADMIN_PASSWORD_CHANGE_REQUIRED"));
  next();
};

export const requireAdminPasswordChangeAccess = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.adminSession) return next(new AppError("Admin access is required", 401, "ADMIN_ACCESS_REQUIRED"));
  next();
};
