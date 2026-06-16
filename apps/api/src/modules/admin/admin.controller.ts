import { Request, Response, NextFunction } from "express";
import { getAuthUserId } from "../../utils/getAuthUserId";
import {
  approveAdminProperty,
  getAdminDashboard,
  getAdminUserById,
  getAdminUsers,
  getPendingListings,
  getPendingMandates,
  getPendingProperties,
  getPendingReports,
  rejectAdminProperty,
  updateAdminUserStatus,
  verifyAdminUser
} from "./admin.service";

import {
  createSuperAdminUser,
  deactivateSuperAdminUser,
  getAuditLogs,
  getSystemStats,
  updateSuperAdminUserRole
} from "./admin.service";

export const getAdminDashboardController = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dashboard = await getAdminDashboard();

    res.status(200).json({
      success: true,
      message: "Admin dashboard fetched successfully",
      data: dashboard
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminUsersController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getAdminUsers(req.query);

    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminUserByIdController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await getAdminUserById(req.params.id);

    res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: user
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminUserStatusController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await updateAdminUserStatus(
      req.params.id,
      req.body.is_active
    );

    res.status(200).json({
      success: true,
      message: "User account status updated successfully",
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

export const verifyAdminUserController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await verifyAdminUser(
      req.params.id,
      req.body.verification_status
    );

    res.status(200).json({
      success: true,
      message: "User verification status updated successfully",
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

export const getPendingPropertiesController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getPendingProperties(req.query);

    res.status(200).json({
      success: true,
      message: "Pending properties fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const approveAdminPropertyController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const property = await approveAdminProperty(
      req.params.id,
      getAuthUserId(req)
    );

    res.status(200).json({
      success: true,
      message: "Property approved successfully",
      data: { property }
    });
  } catch (error) {
    next(error);
  }
};

export const rejectAdminPropertyController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const property = await rejectAdminProperty(
      req.params.id,
      getAuthUserId(req),
      req.body.rejection_reason
    );

    res.status(200).json({
      success: true,
      message: "Property rejected successfully",
      data: { property }
    });
  } catch (error) {
    next(error);
  }
};

export const getPendingListingsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getPendingListings(req.query);

    res.status(200).json({
      success: true,
      message: "Pending listings fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getPendingReportsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getPendingReports(req.query);

    res.status(200).json({
      success: true,
      message: "Pending reports fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getPendingMandatesController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getPendingMandates(req.query);

    res.status(200).json({
      success: true,
      message: "Pending mandates fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};


export const createSuperAdminUserController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await createSuperAdminUser(getAuthUserId(req), req.body);

    res.status(201).json({
      success: true,
      message: "Admin user created successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const updateSuperAdminUserRoleController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await updateSuperAdminUserRole(
      getAuthUserId(req),
      req.params.id,
      req.body.role
    );

    res.status(200).json({
      success: true,
      message: "User role updated successfully",
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

export const deactivateSuperAdminUserController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await deactivateSuperAdminUser(
      getAuthUserId(req),
      req.params.id
    );

    res.status(200).json({
      success: true,
      message: "User deactivated successfully",
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

export const getAuditLogsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getAuditLogs(req.query);

    res.status(200).json({
      success: true,
      message: "Audit logs fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getSystemStatsController = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const stats = await getSystemStats();

    res.status(200).json({
      success: true,
      message: "System stats fetched successfully",
      data: stats
    });
  } catch (error) {
    next(error);
  }
};