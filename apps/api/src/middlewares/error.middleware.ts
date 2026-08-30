import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

export function errorMiddleware(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const code = error instanceof AppError ? error.code : undefined;
  const details = error instanceof AppError ? error.details : undefined;
  const message = error instanceof AppError
    ? error.message
    : "Internal server error";

  return res.status(statusCode).json({
    success: false,
    message,
    ...(code ? { code } : {}),
    ...(details ?? {})
  });
}
