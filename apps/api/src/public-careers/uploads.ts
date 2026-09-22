import Busboy from "busboy";
import type { Request } from "express";
import { AuthError } from "../auth/errors.js";
import type { UploadFile } from "../listings/uploads.js";

export const CAREER_RESUME_BYTES = 10 * 1024 * 1024;
const invalid = () => new AuthError(400, "INVALID_RESUME", "Choose a PDF resume no larger than 10 MB.");

export function readCareerApplication(request: Request): Promise<{ data: unknown; file: UploadFile }> {
  return new Promise((resolve, reject) => {
    let parser: ReturnType<typeof Busboy>;
    try { parser = Busboy({ headers: request.headers, limits: { files: 1, fields: 1, parts: 3, fieldSize: 8192, fileSize: CAREER_RESUME_BYTES } }); }
    catch { reject(invalid()); return; }
    let data: unknown, file: UploadFile | undefined, seen = false, failed = false;
    const timer = setTimeout(() => { request.unpipe(parser); parser.destroy(invalid()); request.resume(); }, 120000);
    const abort = () => parser.destroy(invalid()); request.once("aborted", abort);
    parser.on("field", (name, value, info) => { if (name !== "data" || seen || info.valueTruncated) { failed = true; return; } seen = true; try { data = JSON.parse(value); } catch { failed = true; } });
    parser.on("file", (field, stream, info) => {
      if (field !== "resume" || file) failed = true;
      file = { field, mime: info.mimeType, bytes: Buffer.alloc(0) };
      const chunks: Buffer[] = [];
      stream.on("limit", () => { failed = true; }); stream.on("error", () => { failed = true; });
      stream.on("data", (chunk: Buffer) => { if (!failed) chunks.push(chunk); });
      stream.on("end", () => { if (!failed) file!.bytes = Buffer.concat(chunks); });
    });
    for (const event of ["filesLimit", "fieldsLimit", "partsLimit"]) parser.on(event, () => { failed = true; });
    parser.once("error", () => { clearTimeout(timer); request.removeListener("aborted", abort); reject(invalid()); });
    parser.once("close", () => {
      clearTimeout(timer); request.removeListener("aborted", abort);
      if (failed || !seen || !file || !file.bytes.length || file.bytes.length > CAREER_RESUME_BYTES || file.mime !== "application/pdf" || file.bytes.toString("ascii", 0, 5) !== "%PDF-") { reject(invalid()); return; }
      resolve({ data, file });
    });
    request.pipe(parser);
  });
}
