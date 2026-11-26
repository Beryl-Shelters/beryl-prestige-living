import type { ReactNode } from "react";
import { PublicHeader } from "../auth/public-header";
import { PublicSiteFooter } from "./public-site-footer";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return <div className="public-page legal-page"><PublicHeader sessionAware mobileMenu /><main className="legal-main"><article className="legal-content"><h1>{title}</h1><div className="legal-dates"><strong>Effective Date:</strong> 01/01/2025<br /><strong>Last Updated:</strong> 27/03/2025</div>{children}</article></main><PublicSiteFooter /></div>;
}
