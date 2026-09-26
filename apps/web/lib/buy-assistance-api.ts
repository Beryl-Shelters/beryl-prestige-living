export async function submitBuyAssistance(data: FormData) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new Error("Buy assistance services are not configured.");
  const response = await fetch(`${base.replace(/\/$/, "")}/api/v1/public/buy-assistance`, { method: "POST", credentials: "omit", cache: "no-store", body: data });
  const payload = await response.json().catch(() => null) as { success?: boolean; error?: { message?: string } } | null;
  if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || "Your buying assistance request could not be submitted. Please try again.");
}
