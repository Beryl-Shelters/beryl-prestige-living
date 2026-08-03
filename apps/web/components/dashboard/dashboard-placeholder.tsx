"use client";

import { Building2, LogOut, Repeat2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PersonaSwitcher } from "@/components/persona/persona-switcher";
import { useAuth } from "@/context/auth-provider";

export function DashboardPlaceholder({ persona }: { persona: "buyer" | "seller" }) {
  const router = useRouter();
  const { logout } = useAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const Icon = persona === "buyer" ? Search : Building2;
  return <main className="dashboard-placeholder"><section className="dashboard-card"><span className="brand-wordmark">Beryl Shelter</span><div className="mx-auto my-7 grid h-20 w-20 place-items-center rounded-full bg-brand-cream"><Icon size={38} color="var(--color-brand-brown)" /></div><h1 className="page-title">{persona === "buyer" ? "Buyer" : "Seller"} dashboard coming soon</h1><p className="page-copy">Your authentication and onboarding are complete. The full dashboard will be implemented in a later product slice.</p><div className="flex flex-wrap justify-center gap-3"><button className="btn btn-primary" onClick={() => setSwitcherOpen(true)}><Repeat2 size={17} />Switch mode</button><button className="btn btn-secondary" onClick={async () => { await logout(); router.replace("/login"); }}><LogOut size={17} />Log out</button></div></section><PersonaSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} /></main>;
}
