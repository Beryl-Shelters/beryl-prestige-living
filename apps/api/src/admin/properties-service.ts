import { AuthError } from "../auth/errors.js";
import type { AdminPropertyQuery } from "./properties-model.js";
import type { AdminPropertiesRepository } from "./properties-repository.js";

export class AdminPropertiesService {
  constructor(private readonly repository: AdminPropertiesRepository) {}
  directory(query: AdminPropertyQuery) { return this.repository.directory(query); }
  detail(code: string) { return this.repository.detail(code); }
  approve(code: string, reviewerId: string, version: number) { return this.repository.review(code, reviewerId, "APPROVE", version); }
  reject(code: string, reviewerId: string, version: number, reason: string) { return this.repository.review(code, reviewerId, "REJECT", version, reason); }
  async document(code: string, documentId: string, mandate: boolean) {
    const value = await this.repository.document(code, documentId, mandate);
    if (!value) throw new AuthError(404, "PROPERTY_DOCUMENT_NOT_FOUND", "Property document not found.");
    return value;
  }
  async signature(code: string) {
    const value = await this.repository.signature(code);
    if (!value) throw new AuthError(404, "PROPERTY_DOCUMENT_NOT_FOUND", "Property document not found.");
    return value;
  }
}
