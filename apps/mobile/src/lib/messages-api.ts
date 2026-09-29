import { appendPickedFile, type PickedFile } from "./file-upload-helper";
import type { ApiTransport } from "./listings-api";

export type TicketStatus = "OPEN" | "RESOLVED";

export type TicketAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export type TicketMessage = {
  id: string;
  senderType: "CUSTOMER" | "SUPPORT";
  body: string;
  createdAt: string;
  readByCustomerAt: string | null;
  attachments?: TicketAttachment[];
};

export type TicketSummary = {
  id: string;
  ticketNumber: string;
  subject: string;
  status: TicketStatus;
  resolvedAt: string | null;
  latestMessagePreview: string;
  lastActivityAt: string;
  unread: boolean;
};

export type TicketDetail = {
  id: string;
  ticketNumber: string;
  subject: string;
  status: TicketStatus;
  resolvedAt: string | null;
  createdAt: string;
  lastActivityAt: string;
  messages: TicketMessage[];
};

export function createMessagesApi(client?: ApiTransport) {
  const getClient = (): ApiTransport => {
    if (client) return client;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("./api-client") as typeof import("./api-client")).apiClient;
  };

  return {
    async list(q = ""): Promise<{ items: TicketSummary[] }> {
      const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      return getClient().request<{ items: TicketSummary[] }>(`/api/v1/messages/tickets${query}`);
    },

    async detail(ticketId: string): Promise<TicketDetail> {
      return getClient().request<TicketDetail>(
        `/api/v1/messages/tickets/${encodeURIComponent(ticketId)}`
      );
    },

    async create(
      subject: string,
      message: string,
      file?: PickedFile
    ): Promise<TicketDetail> {
      if (file) {
        const formData = new FormData();
        formData.append("data", JSON.stringify({ subject: subject.trim(), message: message.trim() }));
        await appendPickedFile(formData, "attachment", file);
        return getClient().request<TicketDetail>("/api/v1/messages/tickets", {
          method: "POST",
          body: formData,
        });
      }

      return getClient().request<TicketDetail>("/api/v1/messages/tickets", {
        method: "POST",
        body: { subject: subject.trim(), message: message.trim() },
      });
    },

    async reply(
      ticketId: string,
      message: string,
      file?: PickedFile
    ): Promise<TicketDetail> {
      if (file) {
        const formData = new FormData();
        formData.append("data", JSON.stringify({ message: message.trim() }));
        await appendPickedFile(formData, "attachment", file);
        return getClient().request<TicketDetail>(
          `/api/v1/messages/tickets/${encodeURIComponent(ticketId)}/messages`,
          {
            method: "POST",
            body: formData,
          }
        );
      }

      return getClient().request<TicketDetail>(
        `/api/v1/messages/tickets/${encodeURIComponent(ticketId)}/messages`,
        {
          method: "POST",
          body: { message: message.trim() },
        }
      );
    },

    async acknowledge(ticketId: string, throughMessageId: string): Promise<{ acknowledged: boolean }> {
      return getClient().request<{ acknowledged: boolean }>(
        `/api/v1/messages/tickets/${encodeURIComponent(ticketId)}/read`,
        {
          method: "POST",
          body: { throughMessageId },
        }
      );
    },
  };
}

export const messagesApi = createMessagesApi();
