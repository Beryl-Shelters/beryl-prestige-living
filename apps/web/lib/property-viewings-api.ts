export type PropertyViewingInput = {
  propertyCode: string; firstName: string; lastName: string; email: string; phone: string;
  preferredDate: string | null; preferredTime: string | null; flexibleDates: boolean;
};

export async function submitPropertyViewing(input: PropertyViewingInput) {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!configured) throw new Error("Viewing services are not configured yet.");
  const response = await fetch(`${configured.replace(/\/$/, "")}/api/v1/public/property-viewings`, {
    method: "POST", credentials: "omit", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null) as { success?: boolean; error?: { message?: string } } | null;
  if (!response.ok || !payload?.success) throw new Error(payload?.error?.message ?? "Your viewing could not be scheduled. Please try again.");
}
