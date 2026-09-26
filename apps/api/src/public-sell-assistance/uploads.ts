import Busboy from "busboy";
import type { Request } from "express";
import { AuthError } from "../auth/errors.js";
import { DOCUMENT_BYTES, IMAGE_BYTES, validateFile, type UploadFile } from "../listings/uploads.js";

export const MAX_ASSISTANCE_IMAGES = 6;
const invalid = () => new AuthError(400, "INVALID_SELL_ASSISTANCE_UPLOAD", "Choose up to 6 PNG, JPEG, or WEBP property images of 5 MB each and one PDF, PNG, or JPEG authorization document of 10 MB.");

export function readSellAssistance(request: Request): Promise<{ data: unknown; images: UploadFile[]; authorizationDocument?: UploadFile }> {
  return new Promise((resolve, reject) => {
    let parser: ReturnType<typeof Busboy>;
    try {
      parser = Busboy({ headers: request.headers, limits: { files: MAX_ASSISTANCE_IMAGES + 1, fields: 1, parts: MAX_ASSISTANCE_IMAGES + 3, fieldSize: 32768, fileSize: DOCUMENT_BYTES } });
    } catch { reject(invalid()); return; }
    let data: unknown, fieldSeen = false, failed = false, total = 0;
    const images: UploadFile[] = []; let authorizationDocument: UploadFile | undefined;
    const timer = setTimeout(() => { failed = true; request.unpipe(parser); parser.destroy(invalid()); request.resume(); }, 120000);
    const abort = () => parser.destroy(invalid()); request.once("aborted", abort);
    parser.on("field", (name, value, info) => {
      if (name !== "data" || fieldSeen || info.valueTruncated) { failed = true; return; }
      fieldSeen = true; try { data = JSON.parse(value); } catch { failed = true; }
    });
    parser.on("file", (field, stream, info) => {
      const file: UploadFile = { field, mime: info.mimeType, bytes: Buffer.alloc(0) }; const chunks: Buffer[] = [];
      if (field === "propertyImages") images.push(file);
      else if (field === "authorizationDocument" && !authorizationDocument) authorizationDocument = file;
      else failed = true;
      stream.on("limit", () => { failed = true; }); stream.on("error", () => { failed = true; });
      stream.on("data", (chunk: Buffer) => { total += chunk.length; if (total > MAX_ASSISTANCE_IMAGES * IMAGE_BYTES + DOCUMENT_BYTES) failed = true; if (!failed) chunks.push(chunk); });
      stream.on("end", () => { if (!failed) file.bytes = Buffer.concat(chunks); });
    });
    for (const event of ["filesLimit", "fieldsLimit", "partsLimit"]) parser.on(event, () => { failed = true; });
    parser.once("error", () => { clearTimeout(timer); request.removeListener("aborted", abort); reject(invalid()); });
    parser.once("close", () => {
      clearTimeout(timer); request.removeListener("aborted", abort);
      if (failed || !fieldSeen || images.length > MAX_ASSISTANCE_IMAGES) { reject(invalid()); return; }
      try {
        images.forEach(file => validateFile(file, false));
        if (authorizationDocument) validateFile(authorizationDocument, true);
        resolve({ data, images, ...(authorizationDocument ? { authorizationDocument } : {}) });
      } catch { reject(invalid()); }
    });
    request.pipe(parser);
  });
}
