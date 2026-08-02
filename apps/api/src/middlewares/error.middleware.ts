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

  return res.status(statusCode).json({
    success: false,
    message: error.message || "Internal server error",
    ...(code ? { code } : {})
  });
}
