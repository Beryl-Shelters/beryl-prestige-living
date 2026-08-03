import { NextFunction, Request, Response } from "express";
import { getAuthUserId } from "../../utils/getAuthUserId";
import { customerOnboardingService } from "./customer-onboarding.runtime";

export const getOnboardingStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await customerOnboardingService.getStatus(getAuthUserId(req));
    res.status(200).json({
      success: true,
      message: "Onboarding status fetched successfully",
      data
    });
  } catch (error) {
    next(error);
  }
};

export const completeBuyerOnboarding = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await customerOnboardingService.completeBuyer(
      getAuthUserId(req),
      req.body
    );
    res.status(200).json({
      success: true,
      message: "Buyer profile completed successfully",
      data
    });
  } catch (error) {
    next(error);
  }
};

export const completeSellerOnboarding = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await customerOnboardingService.completeSeller(
      getAuthUserId(req),
      req.body
    );
    res.status(200).json({
      success: true,
      message: "Seller profile completed successfully",
      data
    });
  } catch (error) {
    next(error);
  }
};

export const getPersonas = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await customerOnboardingService.getPersonas(getAuthUserId(req));
    res.status(200).json({
      success: true,
      message: "Personas fetched successfully",
      data
    });
  } catch (error) {
    next(error);
  }
};

export const activatePersona = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await customerOnboardingService.activatePersona(
      getAuthUserId(req),
      req.body.personaType
    );
    res.status(200).json({
      success: true,
      message: "Persona activated successfully",
      ...(data.alreadyActivated ? { code: "PERSONA_ALREADY_ACTIVE" } : {}),
      data
    });
  } catch (error) {
    next(error);
  }
};

export const switchActivePersona = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await customerOnboardingService.switchPersona(
      getAuthUserId(req),
      req.body.personaType
    );
    res.status(200).json({
      success: true,
      message: "Active persona changed successfully",
      ...(data.alreadyActive ? { code: "PERSONA_ALREADY_ACTIVE" } : {}),
      data
    });
  } catch (error) {
    next(error);
  }
};
