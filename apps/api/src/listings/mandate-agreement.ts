export const SALES_MANDATE_AGREEMENT_VERSION = "web-exclusive-sales-mandate-v1";

export type AgreementClause = {
  number: number;
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

// Client-approved Customer Web wording. This is the only legal-text source for
// generated mandates. New wording requires a new version identifier.
export const SALES_MANDATE_CLAUSES: readonly AgreementClause[] = [
  {
    number: 1,
    title: "PROFESSIONAL/BROKERAGE FEE",
    paragraphs: ["BERYL SHELTER NIGERIA LIMITED will charge a professional fee of 5% of the gross sale price."],
  },
  {
    number: 2,
    title: "INSTRUCTIONS",
    paragraphs: [],
    bullets: [
      "BERYL SHELTER NIGERIA LIMITED will only accept direct written instructions from Vendor/Seller whether by letter, email or chat and will not accept oral instructions whether by telephone or physical conversation and will not accept instructions from agents or third parties.",
      "This mandate is valid for 6 months renewable automatically for a further mandate of 6 months unless terminated by the Client.",
    ],
  },
  {
    number: 3,
    title: "AUTHORITY",
    paragraphs: ["BERYL SHELTER NIGERIA LIMITED is only a broking and marketing firm and does not have authority to transfer property. BERYL SHELTER NIGERIA LIMITED does not charge legal fees and Clients are advised to seek legal advice."],
  },
  {
    number: 4,
    title: "NEGOTIATION",
    paragraphs: ["BERYL SHELTER NIGERIA LIMITED will quantify potential buyers and negotiate the sales transaction on behalf of the Seller/Vendor and will achieve a price within the range agreed with the Seller/Client or consistent with offer accepted by the Seller/Client."],
  },
  {
    number: 5,
    title: "MARKETING",
    paragraphs: ["BERYL SHELTER NIGERIA LIMITED will market and advertise and present the property to target market, and the Seller/Client acknowledges that BERYL SHELTER NIGERIA LIMITED will invest in resources in this regard and will be remunerated for its effort from the professional fees in clause 1 above."],
  },
  {
    number: 6,
    title: "",
    paragraphs: ["BERYL SHELTER NIGERIA LIMITED shall manage the sales administration and relationship between the Seller/Client and the Buyer until the sale is closed."],
  },
  {
    number: 7,
    title: "PROFESSIONAL FEE CONDITIONS",
    paragraphs: [],
    bullets: [
      "Fees are earned upon written acceptance of any written offer and payable upon payment of the purchase price.",
      "A minimum of 1% of the gross sale price is payable if Seller/Client withdraws or terminates instructions after 6 months.",
      "When the Seller/Client accepts the 1st installment of payment from the Buyer, BERYL SHELTER NIGERIA LIMITED shall deduct its full fees of 5% from 1st payments made.",
    ],
  },
  {
    number: 8,
    title: "ACCESS TO PROPERTY",
    paragraphs: ["Consultants (Agents) and interested Buyers shall be permitted to view the property at reasonable times by appointment within 24 hours notice in the company of an accredited representative of BERYL SHELTER NIGERIA LIMITED."],
  },
  {
    number: 9,
    title: "SIGNAGE",
    paragraphs: ["BERYL SHELTER NIGERIA LIMITED as the exclusive marketing / sales consultant will be authorized to place its signage on your property/development(s)."],
  },
  {
    number: 10,
    title: "I hereby consent to the above mandate",
    paragraphs: [],
  },
] as const;

export const SALES_MANDATE_AGREEMENT_SNAPSHOT = {
  version: SALES_MANDATE_AGREEMENT_VERSION,
  company: "BERYL SHELTER NIGERIA LIMITED",
  title: "Exclusive Sales Mandate (Sellers)",
  clauses: SALES_MANDATE_CLAUSES,
} as const;
