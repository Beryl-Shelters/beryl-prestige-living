import Busboy from "busboy";
import type { Request } from "express";
import { AuthError } from "../auth/errors.js";
import {
  DOCUMENT_BYTES,
  validateFile,
  type UploadFile,
} from "../listings/uploads.js";

const invalid = () =>
  new AuthError(
    400,
    "INVALID_PAYMENT_RECEIPT",
    "Choose a PDF, PNG, or JPG receipt up to 10 MB.",
  );
export function readPaymentReceipt(
  request: Request,
): Promise<{ data: unknown; file: UploadFile }> {
  return new Promise((resolve, reject) => {
    let parser: ReturnType<typeof Busboy>;
    try {
      parser = Busboy({
        headers: request.headers,
        limits: {
          files: 1,
          fields: 1,
          fieldSize: 2048,
          fileSize: DOCUMENT_BYTES,
          parts: 3,
        },
      });
    } catch {
      reject(invalid());
      return;
    }
    let data: unknown,
      file: UploadFile | undefined,
      seen = false,
      failed = false;
    const timer = setTimeout(() => {
      failed = true;
      request.unpipe(parser);
      parser.destroy(invalid());
      request.resume();
    }, 120000);
    parser.on("field", (name, value, info) => {
      if (name !== "data" || seen || info.valueTruncated) {
        failed = true;
        return;
      }
      seen = true;
      try {
        data = JSON.parse(value);
      } catch {
        failed = true;
      }
    });
    parser.on("file", (field, stream, info) => {
      if (field !== "receipt" || file) {
        failed = true;
        stream.resume();
        return;
      }
      const chunks: Buffer[] = [];
      file = { field, mime: info.mimeType, bytes: Buffer.alloc(0) };
      stream.on("limit", () => {
        failed = true;
      });
      stream.on("error", () => {
        failed = true;
      });
      stream.on("data", (chunk: Buffer) => {
        if (!failed) chunks.push(chunk);
      });
      stream.on("end", () => {
        if (file && !failed) file.bytes = Buffer.concat(chunks);
      });
    });
    for (const event of ["filesLimit", "fieldsLimit", "partsLimit"])
      parser.on(event, () => {
        failed = true;
      });
    const abort = () => parser.destroy(invalid());
    request.once("aborted", abort);
    parser.once("error", () => {
      clearTimeout(timer);
      reject(invalid());
    });
    parser.once("close", () => {
      clearTimeout(timer);
      request.removeListener("aborted", abort);
      try {
        if (failed || !seen || !file) throw invalid();
        validateFile(file, true);
        resolve({ data, file });
      } catch {
        reject(invalid());
      }
    });
    request.pipe(parser);
  });
}
