import { randomUUID } from "node:crypto";
import { AuthError } from "../auth/errors.js";
import type { MediaStorage } from "../listings/media.js";
import type { UploadFile } from "../listings/uploads.js";
import type { CareerApplicationInput } from "./model.js";
import type { CareerApplicationsRepository } from "./repository.js";

const unavailable = () => new AuthError(503, "CAREERS_UNAVAILABLE", "Your application could not be submitted. Please try again.");
export class CareerApplicationsService {
  constructor(private readonly repository: CareerApplicationsRepository, private readonly storage: MediaStorage) {}
  async cleanup(): Promise<void> {
    try {
      for (const publicId of await this.repository.abandoned()) {
        try {
          await this.storage.remove({ public_id: publicId, resource_type: "raw", delivery_type: "authenticated" });
          await this.repository.forget(publicId);
        } catch { console.warn(JSON.stringify({ event: "career_resume_cleanup_pending" })); }
      }
    } catch { console.warn(JSON.stringify({ event: "career_resume_cleanup_unavailable" })); }
  }
  async submit(input: CareerApplicationInput, file: UploadFile): Promise<void> {
    await this.cleanup();
    const publicId = `beryl-v2/careers/${randomUUID()}.pdf`;
    const asset = { public_id: publicId, resource_type: "raw" as const, delivery_type: "authenticated" as const };
    try {
      await this.repository.reserve(publicId);
      await this.storage.upload(file, asset);
      // An ambiguous provider/DB response must not trigger an eager delete:
      // the pending reservation remains for delayed, status-checked cleanup.
      await this.repository.accept(publicId, input, file.bytes.length);
    } catch { throw unavailable(); }
  }
}
