import { z } from "zod";

export const createNotificationSchema = z.object({
  user_id: z.string().uuid(),
  type: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  metadata: z.record(z.any()).optional()
});