import { Request, Response, NextFunction } from "express";
import {
  changeMyPassword,
  getMyProfile,
  updateMyAvatar,
  updateMyProfile
} from "./profile.service";
import { getAuthUserId } from "../../utils/getAuthUserId";


export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const profile = await getMyProfile(getAuthUserId(req));

    res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: { profile }
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const profile = await updateMyProfile(getAuthUserId(req), req.body);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: { profile }
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await changeMyPassword(getAuthUserId(req), req.body.new_password);

    res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    next(error);
  }
};

export const updateAvatar = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const profile = await updateMyAvatar(getAuthUserId(req), req.file);

    res.status(200).json({
      success: true,
      message: "Avatar updated successfully",
      data: { profile }
    });
  } catch (error) {
    next(error);
  }
};