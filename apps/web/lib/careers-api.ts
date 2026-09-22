export async function submitCareerApplication(data: FormData): Promise<void> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) throw new Error("Applications are temporarily unavailable. Please try again later.");
  let response: Response;
  try { response = await fetch(`${base.replace(/\/$/, "")}/api/v1/public/careers/applications`, { method: "POST", body: data, cache: "no-store" }); }
  catch { throw new Error("Applications are temporarily unavailable. Please try again later."); }
  if (!response.ok) throw new Error(response.status === 429 ? "Too many applications. Please try again later." : "Your application could not be submitted. Please try again.");
  const payload = await response.json() as { success?: boolean; data?: { recorded?: boolean } };
  if (!payload.success || !payload.data?.recorded) throw new Error("Your application could not be submitted. Please try again.");
}
