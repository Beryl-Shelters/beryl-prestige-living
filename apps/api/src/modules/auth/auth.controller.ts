import { Request, Response, NextFunction } from "express";
import { getCurrentUser, loginUser, registerUser } from "./auth.service";
import { getAuthUserId } from "../../utils/getAuthUserId";


export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await registerUser(req.body);

    res.status(201).json({
      success: true,
      message: "Account created successfully. Please verify your email.",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    res.status(200).json({
      success: true,
      message: "Logout successful"
    });
  } catch (error) {
    next(error);
  }
};

export const me = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const profile = await getCurrentUser(getAuthUserId(req));

    res.status(200).json({
      success: true,
      message: "Current user fetched successfully",
      data: {
        user: req.user,
        profile
      }
    });
  } catch (error) {
    next(error);
  }
};