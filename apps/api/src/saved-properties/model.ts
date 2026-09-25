import { z } from "zod";
import type { PublicProperty } from "../public-properties/model.js";

const pageNumber = z.string().regex(/^[1-9]\d{0,5}$/).transform(Number).pipe(z.number().int().min(1).max(100000));
const pageSize = z.string().regex(/^[1-9]\d?$/).transform(Number).pipe(z.number().int().min(1).max(24));
const propertyCode = z.string().trim().min(1).max(100);

export const savedPropertiesQuery = z.strictObject({
  q: z.string().trim().max(100).default(""),
  page: pageNumber.default(1),
  pageSize: pageSize.default(12),
});
export const savedPropertyInput = z.strictObject({ propertyCode });
export const savedPropertyParams = z.strictObject({ propertyCode });
export const savedPropertyStatesQuery = z.strictObject({
  codes: z.string().trim().min(1).max(5049).transform(value => value.split(",").map(code => code.trim()))
    .pipe(z.array(propertyCode).min(1).max(50).refine(codes => new Set(codes).size === codes.length, "Property codes must be unique.")),
});

export type SavedPropertiesQuery = z.output<typeof savedPropertiesQuery>;
export type SavedPropertyPage = { items: PublicProperty[]; page: number; pageSize: number; total: number; totalPages: number };

