export class ApiConfigurationError extends Error {}
export function backendApiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (!base) throw new ApiConfigurationError("NEXT_PUBLIC_API_BASE_URL is not configured.");
  return `${base}/${path.replace(/^\//, "")}`;
}
