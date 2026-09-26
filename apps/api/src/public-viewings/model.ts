import { z } from "zod";
import { publicPropertyCode } from "../public-properties/model.js";

const noControls = (value: string) => [...value].every(character => {
  const point = character.codePointAt(0)!;
  return point > 31 && point !== 127;
});
const name = z.string().trim().min(2).max(80).refine(noControls, "Name contains invalid characters.");
const today = () => new Date().toISOString().slice(0, 10);

export const propertyViewingInput = z.strictObject({
  propertyCode: publicPropertyCode,
  firstName: name,
  lastName: name,
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  phone: z.string().trim().min(7).max(25).regex(/^\+?[0-9()\-\s]+$/, "Enter a valid contact number.").refine(noControls),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => value >= today(), "Preferred date cannot be in the past.").nullable(),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  flexibleDates: z.boolean(),
}).superRefine((value, context) => {
  if (!value.flexibleDates && !value.preferredDate) context.addIssue({ code: "custom", path: ["preferredDate"], message: "Choose a preferred date." });
  if (!value.flexibleDates && !value.preferredTime) context.addIssue({ code: "custom", path: ["preferredTime"], message: "Choose a preferred time." });
});

export type PropertyViewingInput = z.output<typeof propertyViewingInput>;
