import { Request, Response, NextFunction } from "express";
import { getCurrentUser, loginUser } from "./auth.service";
import { getAuthUserId } from "../../utils/getAuthUserId";
import { customerRegistrationService } from "../auth-onboarding/customer-registration.runtime";


export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await customerRegistrationService.register(req.body);

    res.status(201).json({
      success: true,
      message: "Registration successful. Please verify your email.",
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

export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await customerRegistrationService.verifyEmail(req.body);

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const resendVerificationOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await customerRegistrationService.resendVerificationOtp(req.body);

    res.status(202).json({
      success: true,
      message: "If verification is available for this email, a new code will be sent."
    });
  } catch (error) {
    next(error);
  }
};
