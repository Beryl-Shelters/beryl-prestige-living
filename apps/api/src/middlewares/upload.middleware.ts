import multer from "multer";
import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(
        new Error(
          "Only JPG, PNG and WEBP images are allowed"
        )
      );
    }

    cb(null, true);
  }
});

const documentUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new AppError("Only PDF documents are allowed", 400, "INVALID_DOCUMENT_TYPE"));
      return;
    }

    cb(null, true);
  }
});

export const uploadPropertyDocument = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  documentUpload.single("document")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new AppError("Document must not exceed 10MB", 400, "DOCUMENT_TOO_LARGE"));
      return;
    }

    if (error instanceof multer.MulterError) {
      next(new AppError("A single PDF document is required", 400, "INVALID_DOCUMENT_TYPE"));
      return;
    }

    next(error);
  });
};

const referralPaymentReceiptUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.mimetype)) {
      cb(new AppError("Upload a PDF, PNG, or JPG receipt", 400, "PAYMENT_RECEIPT_INVALID"));
      return;
    }
    cb(null, true);
  }
});

export const uploadReferralPaymentReceipt = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  referralPaymentReceiptUpload.single("receipt")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new AppError("Payment receipt must not exceed 10MB", 400, "PAYMENT_RECEIPT_INVALID"));
      return;
    }
    if (error instanceof multer.MulterError) {
      next(new AppError("A single payment receipt is required", 400, "PAYMENT_RECEIPT_REQUIRED"));
      return;
    }
    next(error);
  });
};
