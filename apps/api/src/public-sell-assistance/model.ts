import { z } from "zod";
import { listingOptions, minorUnits } from "../listings/model.js";

export const contactMethods = ["Phone", "Email"] as const;
export const sellerTypes = ["Personal Property", "Family Property", "Developer"] as const;
export const propertyTypes = ["Residential", "Commercial"] as const;
export const lienStatuses = ["Yes", "No", "Not Sure"] as const;

const printable = (value: string) => [...value].every(char => {
  const point = char.codePointAt(0)!;
  return point > 31 && point !== 127;
});
const text = (max: number) => z.string().trim().min(1).max(max).refine(printable);
const optionalText = (max: number) => z.string().trim().max(max).refine(printable).optional()
  .transform(value => value || undefined);

export const sellAssistanceInput = z.strictObject({
  contactName: text(120),
  preferredContactMethod: z.enum(contactMethods),
  contactPhone: z.string().trim().min(7).max(25).regex(/^\+?[0-9 ()-]+$/).refine(value => (value.match(/\d/g) ?? []).length >= 7).optional(),
  contactEmail: z.string().trim().email().max(254).transform(value => value.toLowerCase()).optional(),
  sellerType: z.enum(sellerTypes).optional(),
  location: text(300),
  propertyType: z.enum(propertyTypes),
  landArea: z.number().finite().positive().max(1e9).optional(),
  parkingSpaces: z.number().int().min(0).max(100).optional(),
  facilities: z.array(z.enum(listingOptions.facilities)).max(listingOptions.facilities.length)
    .refine(values => new Set(values).size === values.length),
  units: z.number().int().min(1).max(100000).optional(),
  titleDocument: optionalText(200),
  lienStatus: z.enum(lienStatuses).optional(),
  askingPrice: z.string().regex(/^(0|[1-9]\d{0,12})(\.\d{1,2})?$/).transform(minorUnits),
  minimumDownPaymentPercent: z.number().finite().min(0).max(100).optional(),
  saleAuthorized: z.boolean().optional(),
  likelyTransferableGiftings: optionalText(1000),
}).superRefine((value, context) => {
  if (value.preferredContactMethod === "Phone" && !value.contactPhone) {
    context.addIssue({ code: "custom", path: ["contactPhone"], message: "Enter the phone number Beryl should use." });
  }
  if (value.preferredContactMethod === "Email" && !value.contactEmail) {
    context.addIssue({ code: "custom", path: ["contactEmail"], message: "Enter the email address Beryl should use." });
  }
  if (value.askingPrice <= 0) {
    context.addIssue({ code: "custom", path: ["askingPrice"], message: "Enter a positive asking price." });
  }
});

export type SellAssistanceInput = z.output<typeof sellAssistanceInput>;
