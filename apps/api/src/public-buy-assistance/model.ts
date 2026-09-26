import { z } from "zod";
import { listingOptions, minorUnits } from "../listings/model.js";
import { contactMethods } from "../public-sell-assistance/model.js";

export const bedroomOptions = ["1", "2", "3", "4", "5", "6", "7+"] as const;
export const paymentIntents = ["Outright Cash Purchase", "Mortgage"] as const;
export const purchaseTimings = ["Immediately", "Within 1 Month", "Within 3 Months", "Within 6 Months", "Within 12 Months", "Flexible"] as const;
const printable = (value: string) => [...value].every(char => { const point = char.codePointAt(0)!; return point > 31 && point !== 127; });
const optionalText = (max: number) => z.string().trim().max(max).refine(printable).optional().transform(value => value || undefined);

export const buyAssistanceInput = z.strictObject({
  contactName: z.string().trim().min(2).max(120).refine(printable),
  preferredContactMethod: z.enum(contactMethods),
  contactPhone: z.string().trim().min(7).max(25).regex(/^\+?[0-9 ()-]+$/).refine(value => (value.match(/\d/g) ?? []).length >= 7).optional(),
  contactEmail: z.string().trim().email().max(254).transform(value => value.toLowerCase()).optional(),
  propertyType: z.enum(listingOptions.property_type),
  propertySubtype: z.enum(listingOptions.property_subtype).optional(),
  bedrooms: z.enum(bedroomOptions).optional(), bathrooms: z.enum(bedroomOptions).optional(),
  locality: optionalText(120), state: z.enum(listingOptions.state), city: optionalText(100),
  facilities: z.array(z.enum(listingOptions.facilities)).max(listingOptions.facilities.length).refine(values => new Set(values).size === values.length),
  budget: z.string().regex(/^(0|[1-9]\d{0,12})(\.\d{1,2})?$/).transform(minorUnits),
  paymentIntent: z.enum(paymentIntents).optional(), timing: z.enum(purchaseTimings).optional(),
  likelyTransferableGiftings: optionalText(1000),
}).superRefine((value, context) => {
  if (value.preferredContactMethod === "Phone" && !value.contactPhone) context.addIssue({ code: "custom", path: ["contactPhone"], message: "Enter the phone number Beryl should use." });
  if (value.preferredContactMethod === "Email" && !value.contactEmail) context.addIssue({ code: "custom", path: ["contactEmail"], message: "Enter the email address Beryl should use." });
  if (value.propertyType === "Residential" && !value.propertySubtype) context.addIssue({ code: "custom", path: ["propertySubtype"], message: "Select a residential property subtype." });
  if (value.propertyType === "Commercial" && value.propertySubtype) context.addIssue({ code: "custom", path: ["propertySubtype"], message: "Property subtype is not applicable to Commercial requests." });
  if (value.propertyType === "Commercial" && (value.bedrooms || value.bathrooms)) context.addIssue({ code: "custom", path: ["bedrooms"], message: "Bedrooms and bathrooms are not applicable to Commercial requests." });
  if (value.budget <= 0) context.addIssue({ code: "custom", path: ["budget"], message: "Enter a positive budget." });
});
export type BuyAssistanceInput = z.output<typeof buyAssistanceInput>;
