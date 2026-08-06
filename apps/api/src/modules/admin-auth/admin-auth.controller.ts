import { NextFunction, Request, Response } from "express";
import { adminAuthService } from "./admin-auth.runtime";

const send = (res: Response, status: number, message: string, data: unknown) => res.status(status).json({ success: true, message, data });
export const invite = async (req: Request, res: Response, next: NextFunction) => { try { send(res, 201, "Admin invitation sent successfully", await adminAuthService.invite(req.user!.id, req.body)); } catch (error) { next(error); } };
export const resendInvitation = async (req: Request, res: Response, next: NextFunction) => { try { send(res, 202, "Admin invitation resent successfully", await adminAuthService.resendInvitation(req.user!.id, req.params.adminId)); } catch (error) { next(error); } };
export const activate = async (req: Request, res: Response, next: NextFunction) => { try { send(res, 202, "Activation code sent successfully", await adminAuthService.activate(req.body)); } catch (error) { next(error); } };
export const resendActivationOtp = async (req: Request, res: Response, next: NextFunction) => { try { send(res, 202, "Activation code resent successfully", await adminAuthService.resendActivationOtp(req.body.challengeId)); } catch (error) { next(error); } };
export const verifyActivationOtp = async (req: Request, res: Response, next: NextFunction) => { try { send(res, 200, "Activation code verified successfully", await adminAuthService.verifyActivationOtp(req.body)); } catch (error) { next(error); } };
export const setPassword = async (req: Request, res: Response, next: NextFunction) => { try { send(res, 200, "Admin account activated successfully", await adminAuthService.setPassword(req.body)); } catch (error) { next(error); } };
