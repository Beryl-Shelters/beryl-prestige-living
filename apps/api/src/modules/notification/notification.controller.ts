import { Request, Response, NextFunction } from "express";
import { getAuthUserId } from "../../utils/getAuthUserId";
import {
  deleteNotification,
  getMyNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  sendAdminNotification
} from "./notification.service";

export const getMyNotificationsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getMyNotifications(getAuthUserId(req), req.query);

    res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getUnreadNotificationCountController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const count = await getUnreadNotificationCount(getAuthUserId(req));

    res.status(200).json({
      success: true,
      message: "Unread notification count fetched successfully",
      data: { count }
    });
  } catch (error) {
    next(error);
  }
};

export const markNotificationAsReadController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const notification = await markNotificationAsRead(
      req.params.id,
      getAuthUserId(req)
    );

    res.status(200).json({
      success: true,
      message: "Notification marked as read successfully",
      data: { notification }
    });
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsAsReadController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await markAllNotificationsAsRead(getAuthUserId(req));

    res.status(200).json({
      success: true,
      message: "All notifications marked as read successfully"
    });
  } catch (error) {
    next(error);
  }
};

export const deleteNotificationController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await deleteNotification(req.params.id, getAuthUserId(req));

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};

export const sendAdminNotificationController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const notification = await sendAdminNotification(req.body);

    res.status(201).json({
      success: true,
      message: "Notification sent successfully",
      data: { notification }
    });
  } catch (error) {
    next(error);
  }
};