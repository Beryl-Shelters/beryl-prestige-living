import type { AdminLeadQuery } from "./leads-model.js";
import type { AdminLeadsRepository } from "./leads-repository.js";

export class AdminLeadsService {
  constructor(private readonly repository: AdminLeadsRepository) {}
  directory(query: AdminLeadQuery) { return this.repository.directory(query); }
  detail(publicId: string) { return this.repository.detail(publicId); }
  move(publicId: string, adminId: string, stage: "CONTACTED" | "WON" | "LOST", version: number) {
    return this.repository.move(publicId, adminId, stage, version);
  }
}
