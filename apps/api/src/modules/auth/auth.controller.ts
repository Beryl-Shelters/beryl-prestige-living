import { Request, Response, NextFunction } from "express";
import { getCurrentUser } from "./auth.service";
import { getAuthUserId } from "../../utils/getAuthUserId";
import { customerRegistrationService } from "../auth-onboarding/customer-registration.runtime";
import { customerAuthenticationService } from "../auth-onboarding/customer-authentication.runtime";
import { AppError } from "../../utils/AppError";
import { preAuthCustomerAnalyticsDistinctId } from "../../analytics/customer-analytics-identity";


export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await customerRegistrationService.register(req.body, preAuthCustomerAnalyticsDistinctId(req));

    res.status(201).json({
      success: true,
      message: "Account created. Check your email for the verification code.",
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
    const result = await customerAuthenticationService.login(req.body, preAuthCustomerAnalyticsDistinctId(req));

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
    if (!req.customerSession) {
      throw new AppError("Customer session was not found", 401, "SESSION_NOT_FOUND");
    }
    await customerAuthenticationService.logout(
      {
        userId: getAuthUserId(req),
        sessionId: req.customerSession.id
      },
      req.body.refreshToken
    );
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

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await customerAuthenticationService.forgotPassword(req.body.email);
    res.status(202).json({
      success: true,
      message:
        "If an account exists for this email, password-reset instructions have been sent.",
      data
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPasswordResetOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await customerAuthenticationService.verifyPasswordResetOtp(
      req.body
    );
    res.status(200).json({
      success: true,
      message: "Password reset code verified successfully",
      data
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await customerAuthenticationService.resetPassword(
      req.body.resetToken,
      req.body.newPassword
    );
    res.status(200).json({
      success: true,
      message: "Password reset successfully. Please log in with your new password.",
      data
    });
  } catch (error) {
    next(error);
  }
};

export const refreshSession = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await customerAuthenticationService.refresh(req.body.refreshToken);
    res.status(200).json({
      success: true,
      message: "Session refreshed successfully",
      data
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
    const data = await customerAuthenticationService.changePassword(
      getAuthUserId(req),
      req.body.currentPassword,
      req.body.newPassword
    );
    res.status(200).json({
      success: true,
      message: "Password changed successfully. Please log in again.",
      data
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
    const result = await customerRegistrationService.resendVerificationOtp(req.body);

    res.status(202).json({
      success: true,
      message: "If the account is awaiting verification, a new code has been sent.",
      data: {
        resendAvailableIn: result.resendAvailableIn
      }
    });
  } catch (error) {
    next(error);
  }
};
