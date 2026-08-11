import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { customerAppUrl, isPublicWebHost } from "@/lib/site-urls";

export default async function HomePage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (isPublicWebHost(host)) {
    return <main className="dashboard-placeholder"><section className="dashboard-card"><h1 className="page-title">Beryl Shelter</h1><p className="page-copy">Find a home you can trust or list your property with confidence.</p><div className="flex flex-wrap gap-3"><a className="btn btn-primary" href={customerAppUrl("/signup")}>Create account</a><a className="btn btn-secondary" href={customerAppUrl("/login")}>Log in</a></div></section></main>;
  }

  redirect("/signup");
}
