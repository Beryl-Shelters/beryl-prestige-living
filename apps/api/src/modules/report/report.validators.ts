import { z } from "zod";

export const createReportSchema = z
  .object({
    property_id: z.string().uuid().optional(),
    agent_id: z.string().uuid().optional(),
    report_type: z.string().min(1),
    reason: z.string().min(5)
  })
  .refine(
    data => data.property_id || data.agent_id,
    {
      message: "property_id or agent_id is required"
    }
  );

export const reviewReportSchema = z.object({
  status: z.enum([
    "pending",
    "under_review",
    "resolved",
    "rejected"
  ]),
  resolution_note: z.string().optional()
});
