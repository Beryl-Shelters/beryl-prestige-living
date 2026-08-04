"use client";

import { Building2, Check, Plus, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiAlert, Spinner } from "@/components/ui/feedback";
import { customerApi } from "@/lib/api/client";
import { apiErrorOf } from "@/lib/api/errors";
import type { PersonaState, PersonaType } from "@/lib/contracts";
import { routeForNextAction } from "@/lib/navigation";

const labels: Record<PersonaType, { title: string; subtitle: string }> = {
  BUYER: { title: "Buyer", subtitle: "Find & save properties" },
  SELLER_DEVELOPER: { title: "Seller", subtitle: "List and manage properties" }
};

export function PersonaSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const query = useQuery({ queryKey: ["personas"], queryFn: () => customerApi.personas(), enabled: open });
  const activate = useMutation({ mutationFn: customerApi.activatePersona });
  const switchPersona = useMutation({ mutationFn: customerApi.switchPersona });

  useEffect(() => {
    if (!open) return;
    const root = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    root?.querySelector<HTMLElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>("button:not([disabled])"));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [open, onClose]);

  if (!open) return null;
  const activePersona = query.data?.data.activePersona;
  const personas = query.data?.data.personas ?? (query.isLoading ? [] : ([{ type: "BUYER", activated: activePersona === "BUYER" }, { type: "SELLER_DEVELOPER", activated: activePersona === "SELLER_DEVELOPER" }] as PersonaState[]));
  const act = async (persona: PersonaState) => {
    setError("");
    try {
      const result = persona.activated ? await switchPersona.mutateAsync(persona.type) : await activate.mutateAsync(persona.type);
      onClose();
      router.push(routeForNextAction(result.data.nextAction));
    } catch (caught) { setError(apiErrorOf(caught).message); }
  };

  return <div className="persona-dialog-backdrop"><button type="button" className="persona-dialog-dismiss" aria-label="Close persona switcher backdrop" onClick={onClose} /><div ref={dialog} className="persona-dialog" role="dialog" aria-modal="true" aria-labelledby="persona-title"><header className="flex items-start justify-between p-5"><div><h2 id="persona-title" className="text-lg font-extrabold">Switch mode</h2><p className="mt-1 text-sm text-brand-muted">Use Beryl as a buyer, a seller, or both. Your account details stay the same.</p></div><button className="icon-button h-10 w-10" onClick={onClose} aria-label="Close persona switcher"><X size={20} /></button></header>{query.isLoading ? <div className="grid place-items-center p-10"><Spinner /></div> : null}{error ? <div className="px-5 pb-3"><ApiAlert>{error}</ApiAlert></div> : null}{personas.map((persona) => { const isActive = persona.type === activePersona; const Icon = persona.type === "BUYER" ? UserRound : Building2; const busy = activate.isPending || switchPersona.isPending; return <div className="persona-row" key={persona.type}><Icon size={25} aria-hidden /><div className="min-w-0 flex-1"><strong>{labels[persona.type].title}</strong><p className="text-xs text-brand-muted">{labels[persona.type].subtitle}</p></div>{isActive ? <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs text-green-800"><Check size={12} />Active</span> : <button className="btn btn-secondary min-h-9 px-3 text-xs" disabled={busy} onClick={() => act(persona)}>{busy ? <Spinner /> : persona.activated ? "Switch" : <><Plus size={14} />Activate</>}</button>}</div>; })}</div></div>;
}
