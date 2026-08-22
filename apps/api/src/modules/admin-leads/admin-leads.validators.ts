import { z } from "zod";

export const leadStages = ["NEW", "CONTACTED", "WON", "LOST"] as const;
export type LeadStage = typeof leadStages[number];

export const adminLeadIdSchema = z.string().uuid();

export const adminLeadListSchema = z.object({
  q: z.string().trim().max(120).optional().transform((value) => value || undefined),
  limit: z.coerce.number().int().min(1).max(50).default(20)
}).strict();

export const updateAdminLeadStageSchema = z.object({
  stage: z.enum(leadStages),
  expectedStage: z.enum(leadStages)
}).strict();
