import { randomUUID } from "node:crypto";
import { AuthError } from "../auth/errors.js";
import type { MediaStorage } from "../listings/media.js";
import type { UploadFile } from "../listings/uploads.js";
import type { SellAssistanceInput } from "./model.js";
import type { AssistanceAsset, SellAssistanceRepository } from "./repository.js";

const unavailable = () => new AuthError(503, "SELL_ASSISTANCE_UNAVAILABLE", "Your assistance request could not be submitted. Please try again.");
const extension = (mime: string) => mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
export class SellAssistanceService {
  constructor(private readonly repository: SellAssistanceRepository, private readonly storage: MediaStorage) {}
  async cleanup(): Promise<void> {
    try {
      for (const request of await this.repository.abandoned()) {
        let complete = true;
        for (const asset of request.assets) {
          try { await this.storage.remove({ public_id: asset.publicId, resource_type: "raw", delivery_type: "authenticated" }); }
          catch { complete = false; console.warn(JSON.stringify({ event: "sell_assistance_cleanup_pending" })); }
        }
        if (complete) await this.repository.forget(request.id).catch(() => console.warn(JSON.stringify({ event: "sell_assistance_cleanup_pending" })));
      }
    } catch { console.warn(JSON.stringify({ event: "sell_assistance_cleanup_unavailable" })); }
  }
  async submit(input: SellAssistanceInput, images: UploadFile[], authorizationDocument?: UploadFile): Promise<void> {
    await this.cleanup(); const id = randomUUID();
    const uploads: { file: UploadFile; asset: AssistanceAsset }[] = images.map((file, index) => ({ file, asset: { publicId: `beryl-v2/sell-assistance/${id}/property-${randomUUID()}.${extension(file.mime)}`, kind: "PROPERTY_IMAGE", mimeType: file.mime, sizeBytes: file.bytes.length, sortOrder: index } }));
    if (authorizationDocument) uploads.push({ file: authorizationDocument, asset: { publicId: `beryl-v2/sell-assistance/${id}/authorization-${randomUUID()}.${extension(authorizationDocument.mime)}`, kind: "AUTHORIZATION_DOCUMENT", mimeType: authorizationDocument.mime, sizeBytes: authorizationDocument.bytes.length, sortOrder: 0 } });
    try {
      await this.repository.reserve(id, input, uploads.map(upload => upload.asset));
      for (const upload of uploads) await this.storage.upload(upload.file, { public_id: upload.asset.publicId, resource_type: "raw", delivery_type: "authenticated" });
      await this.repository.accept(id);
    } catch { throw unavailable(); }
  }
}
