import { randomUUID } from "node:crypto";
import { AuthError } from "../auth/errors.js";
import type { MediaStorage } from "../listings/media.js";
import type { UploadFile } from "../listings/uploads.js";
import type { BuyAssistanceInput } from "./model.js";
import type { BuyAssistanceRepository, BuyMandateAsset } from "./repository.js";

const unavailable = () => new AuthError(503, "BUY_ASSISTANCE_UNAVAILABLE", "Your buying assistance request could not be submitted. Please try again.");
export class BuyAssistanceService {
  constructor(private readonly repository: BuyAssistanceRepository, private readonly storage: MediaStorage) {}
  async cleanup() { try { for (const request of await this.repository.abandoned()) { try { if (request.mandate) await this.storage.remove({ public_id: request.mandate.publicId, resource_type: "raw", delivery_type: "authenticated" }); await this.repository.forget(request.id); } catch { console.warn(JSON.stringify({ event: "buy_assistance_cleanup_pending" })); } } } catch { console.warn(JSON.stringify({ event: "buy_assistance_cleanup_unavailable" })); } }
  async submit(input: BuyAssistanceInput, mandate?: UploadFile) {
    await this.cleanup(); const id = randomUUID(); const asset: BuyMandateAsset | undefined = mandate ? { publicId: `beryl-v2/buy-assistance/${id}/mandate-${randomUUID()}.pdf`, mimeType: "application/pdf", sizeBytes: mandate.bytes.length } : undefined;
    try { await this.repository.reserve(id, input, asset); if (mandate && asset) await this.storage.upload(mandate, { public_id: asset.publicId, resource_type: "raw", delivery_type: "authenticated" }); await this.repository.accept(id); }
    catch { throw unavailable(); }
  }
}
