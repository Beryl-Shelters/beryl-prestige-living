import Busboy from "busboy";
import type { Request } from "express";
import { AuthError } from "../auth/errors.js";
import { DOCUMENT_BYTES, validateFile, type UploadFile } from "../listings/uploads.js";

const invalid = () => new AuthError(400, "INVALID_BUY_MANDATE", "Choose one PDF Buy Mandate no larger than 10 MB.");
export function readBuyAssistance(request: Request): Promise<{ data: unknown; mandate?: UploadFile }> {
  return new Promise((resolve, reject) => {
    let parser: ReturnType<typeof Busboy>;
    try { parser = Busboy({ headers: request.headers, limits: { files: 1, fields: 1, parts: 3, fieldSize: 32768, fileSize: DOCUMENT_BYTES } }); }
    catch { reject(invalid()); return; }
    let data: unknown, mandate: UploadFile | undefined, fieldSeen = false, failed = false;
    const timer = setTimeout(() => { failed = true; request.unpipe(parser); parser.destroy(invalid()); request.resume(); }, 120000);
    const abort = () => parser.destroy(invalid()); request.once("aborted", abort);
    parser.on("field", (name, value, info) => { if (name !== "data" || fieldSeen || info.valueTruncated) { failed = true; return; } fieldSeen = true; try { data = JSON.parse(value); } catch { failed = true; } });
    parser.on("file", (field, stream, info) => {
      if (field !== "buyMandate" || mandate) failed = true;
      const file: UploadFile = { field, mime: info.mimeType, bytes: Buffer.alloc(0) }; mandate = file; const chunks: Buffer[] = [];
      stream.on("limit", () => { failed = true; }); stream.on("error", () => { failed = true; }); stream.on("data", (chunk: Buffer) => { if (!failed) chunks.push(chunk); }); stream.on("end", () => { if (!failed) file.bytes = Buffer.concat(chunks); });
    });
    for (const event of ["filesLimit", "fieldsLimit", "partsLimit"]) parser.on(event, () => { failed = true; });
    parser.once("error", () => { clearTimeout(timer); request.removeListener("aborted", abort); reject(invalid()); });
    parser.once("close", () => {
      clearTimeout(timer); request.removeListener("aborted", abort);
      if (failed || !fieldSeen) { reject(invalid()); return; }
      try { if (mandate) { validateFile(mandate, true); if (mandate.mime !== "application/pdf") throw invalid(); } resolve({ data, ...(mandate ? { mandate } : {}) }); }
      catch { reject(invalid()); }
    });
    request.pipe(parser);
  });
}
