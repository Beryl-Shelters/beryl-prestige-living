import { z } from "zod";

export const careerPositions = ["Frontend Developer", "Backend Developer", "Real Estate Agent", "Sales Manager", "Marketing Specialist"] as const;
const printable = (value: string) => [...value].every(char => { const point = char.codePointAt(0)!; return point > 31 && point !== 127; });
const notesPrintable = (value: string) => [...value].every(char => { const point = char.codePointAt(0)!; return point > 31 && point !== 127 || point === 10 || point === 13; });

export const careerApplicationInput = z.strictObject({
  fullName: z.string().trim().min(2).max(120).refine(printable),
  email: z.email().trim().max(254),
  phone: z.string().trim().min(7).max(25).regex(/^\+?[0-9 ()-]+$/).refine(value => (value.match(/\d/g) ?? []).length >= 7),
  position: z.enum(careerPositions),
  coverLetter: z.string().trim().max(3000).refine(notesPrintable).optional(),
});
export type CareerApplicationInput = z.output<typeof careerApplicationInput>;
