import { z } from "zod";

export const purchasedPropertiesQuery = z.object({
  q: z.string().trim().max(100).default(""),
  page: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(100000)).default(1),
}).strict();

export const purchasedPropertiesPageSize = 10;

export type PurchasedProperty = {
  id: string;
  propertyTitle: string;
  propertyCode: string;
  state: string;
  type: string;
  subtype: string;
  price: string;
  status: string;
  closedAt: string;
};

export type PurchasedPropertiesPage = {
  items: PurchasedProperty[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
