const leadPathPattern = /^\/dashboard\/leads\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const adminPropertyPath = (propertyId: string) => `/dashboard/properties/${encodeURIComponent(propertyId)}`;

export const adminPropertyFromLeadPath = (propertyId: string, leadId: string) =>
  `${adminPropertyPath(propertyId)}?returnTo=${encodeURIComponent(`/dashboard/leads/${encodeURIComponent(leadId)}`)}`;

export const safeAdminPropertyReturnPath = (value: string | string[] | undefined) => {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && leadPathPattern.test(candidate) ? candidate : "/dashboard/leads";
};
