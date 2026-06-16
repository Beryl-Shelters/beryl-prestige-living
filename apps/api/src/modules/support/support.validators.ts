import { z } from "zod";

export const createSupportTicketSchema = z.object({
  subject: z.string().min(3).max(200),
  message: z.string().min(5),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional()
});

export const createTicketMessageSchema = z.object({
  message: z.string().min(1),
  attachment_url: z.string().url().optional()
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"])
});

export const assignTicketSchema = z.object({
  assigned_to: z.string().uuid()
});