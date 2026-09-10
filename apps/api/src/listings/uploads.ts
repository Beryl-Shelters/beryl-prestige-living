import Busboy from "busboy";
import type { Request } from "express";
import { AuthError } from "../auth/errors.js";
import { MAX_IMAGES } from "./model.js";
export type UploadFile = { field: string; mime: string; bytes: Buffer };
export const IMAGE_BYTES = 5*1024*1024;
export const DOCUMENT_BYTES = 10*1024*1024;
const invalid = () => new AuthError(400, "INVALID_UPLOAD", "Choose supported files within the upload limits.");
export function validateFile(file: UploadFile, document: boolean) {
  const b = file.bytes;
  const png = b.length > 8 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = b.length > 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
  const webp = b.length > 12 && b.toString("ascii",0,4) === "RIFF" && b.toString("ascii",8,12) === "WEBP";
  const pdf = b.length > 5 && b.toString("ascii",0,5) === "%PDF-";
  if (!b.length || b.length > (document ? DOCUMENT_BYTES : IMAGE_BYTES)) throw invalid();
  if (!(file.mime === "image/png" && png || file.mime === "image/jpeg" && jpeg || !document && file.mime === "image/webp" && webp || document && file.mime === "application/pdf" && pdf)) throw invalid();
}
export function readUpload(request: Request, document = false): Promise<{ data: unknown; files: UploadFile[] }> {
  return new Promise((resolve, reject) => {
    let parser: ReturnType<typeof Busboy>;
    try { parser = Busboy({ headers: request.headers, limits: { files: document ? 1 : MAX_IMAGES, fields: 1, fieldSize: 32768, fileSize: document ? DOCUMENT_BYTES : IMAGE_BYTES, parts: document ? 3 : MAX_IMAGES+2 } }); }
    catch { reject(invalid()); return; }
    let data: unknown; let failed = false; let total = 0; let fieldSeen = false;
    const files: UploadFile[] = [];
    const timer = setTimeout(() => { failed=true; request.unpipe(parser); parser.destroy(invalid()); request.resume(); }, 120000);
    parser.on("field", (name, value, info) => { if (name !== "data" || fieldSeen || info.valueTruncated) { failed=true; return; } fieldSeen=true; try { data=JSON.parse(value); } catch { failed=true; } });
    parser.on("file", (field, stream, info) => {
      const chunks: Buffer[] = []; const file: UploadFile = { field, mime: info.mimeType, bytes: Buffer.alloc(0) }; files.push(file);
      if (field !== (document ? "document" : "images")) failed=true;
      stream.on("limit", () => { failed=true; });
      stream.on("error", () => { failed=true; });
      stream.on("data", (chunk: Buffer) => { total+=chunk.length; if (total>32*1024*1024) failed=true; if (!failed) chunks.push(chunk); });
      stream.on("end", () => { if (!failed) file.bytes=Buffer.concat(chunks); });
    });
    for (const event of ["filesLimit", "fieldsLimit", "partsLimit"]) parser.on(event, () => { failed=true; });
    const abort = () => { parser.destroy(invalid()); };
    request.once("aborted", abort);
    parser.once("error", () => { failed=true; clearTimeout(timer); reject(invalid()); });
    parser.once("close", () => {
      clearTimeout(timer); request.removeListener("aborted", abort);
      if (failed || !fieldSeen) { reject(invalid()); return; }
      try { files.forEach(file => validateFile(file, document)); resolve({ data, files }); } catch(error) { reject(error); }
    });
    request.pipe(parser);
  });
}
