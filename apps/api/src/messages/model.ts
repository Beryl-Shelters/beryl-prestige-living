import { z } from "zod";

const text = (name: string, max: number) => z.string().trim().min(1, `${name} is required.`).max(max, `${name} must be at most ${max} characters.`);
export const createTicketInput = z.object({ subject: text("Subject",160), message: text("Message",3000) }).strict();
export const replyInput = z.object({ message: text("Message",3000) }).strict();
export const readInput = z.object({ throughMessageId: z.uuid() }).strict();
export const ticketQuery = z.object({ q: z.string().trim().max(100).default("") }).strict();
export type TicketMessage = { id: string; senderType: "CUSTOMER" | "SUPPORT"; body: string; createdAt: string; readByCustomerAt: string | null };
export type TicketSummary = { id: string; ticketNumber: string; subject: string; latestMessagePreview: string; lastActivityAt: string; unread: boolean };
export type TicketDetail = { id: string; ticketNumber: string; subject: string; createdAt: string; lastActivityAt: string; messages: TicketMessage[] };
