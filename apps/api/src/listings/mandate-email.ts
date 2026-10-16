import { unavailable } from "../auth/errors.js";
import type { AdminConfig } from "../admin/config.js";

export type MandateEmailInput = {
  recipient: string;
  customerName: string;
  propertyReference: string;
  listingId: string;
  pdf: Uint8Array;
};

export interface MandateEmail { send(input: MandateEmailInput): Promise<void>; }

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));

export class ResendMandateEmail implements MandateEmail {
  constructor(private readonly config: AdminConfig, private readonly webOrigin: string, private readonly transport: typeof fetch = fetch) {}
  async send(input: MandateEmailInput) {
    const dashboardLink = `${this.webOrigin}/dashboard/listings/${encodeURIComponent(input.listingId)}/edit`;
    const response = await this.transport("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: this.config.inviteFrom,
        to: [input.recipient],
        subject: `Beryl Shelter — Your Sales Mandate for ${input.propertyReference}`,
        html: `<div style="font-family:Arial,sans-serif;color:#21170e;line-height:1.55"><h1 style="color:#b9782e">Beryl Shelter</h1><p>Hello ${escapeHtml(input.customerName || "Customer")},</p><p>Your property details have been saved successfully.</p><p>Please download the attached Exclusive Sales Mandate, print it, complete any remaining information and sign it by hand using a pen.</p><p>After signing, scan or clearly photograph the complete document and upload it through your Beryl Shelter account.</p><p>Your property will remain unpublished until the signed mandate and property details have been reviewed and approved.</p><p><strong>Property Reference:</strong> ${escapeHtml(input.propertyReference)}</p><p><a href="${escapeHtml(dashboardLink)}">Open My Properties for Sale</a></p><p>Regards,<br/>Beryl Shelter Nigeria Limited</p></div>`,
        attachments: [{ filename: `Beryl-Shelter-Sales-Mandate-${input.propertyReference}.pdf`, content: Buffer.from(input.pdf).toString("base64") }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw unavailable();
  }
}
