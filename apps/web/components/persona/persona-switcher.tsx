"use client";

import { Building2, Check, LogOut, Plus, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiAlert, Spinner } from "@/components/ui/feedback";
import { customerApi } from "@/lib/api/client";
import { apiErrorOf } from "@/lib/api/errors";
import type { PersonaState, PersonaType } from "@/lib/contracts";
import { routeForNextAction } from "@/lib/navigation";
import { customerPersonaForAnalytics, trackCustomerEvent, updateCustomerAnalyticsPersona } from "@/lib/analytics/customer";
import { prepareOnboardingAnalyticsTrigger } from "@/lib/analytics/onboarding-trigger";
import { useAuth } from "@/context/auth-provider";

const labels: Record<PersonaType, { title: string; subtitle: string }> = {
  BUYER: { title: "Buyer", subtitle: "Find & save properties" },
  SELLER_DEVELOPER: { title: "Seller", subtitle: "List and manage properties" }
};

export function PersonaSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, refreshSession, logout, logoutPending } = useAuth();
  const dialog = useRef<HTMLDivElement>(null);
  const personaRequestInFlight = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState("");
  const query = useQuery({ queryKey: ["personas"], queryFn: () => customerApi.personas(), enabled: open });
  const activate = useMutation({ mutationFn: customerApi.activatePersona });
  const switchPersona = useMutation({ mutationFn: customerApi.switchPersona });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !mounted) return;
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
  }, [mounted, open, onClose]);

  if (!open || !mounted) return null;
  const activePersona = session?.activePersona ?? query.data?.data.activePersona;
  const personas = query.data?.data.personas ?? session?.personas ?? (query.isLoading ? [] : ([{ type: "BUYER", activated: activePersona === "BUYER" }, { type: "SELLER_DEVELOPER", activated: activePersona === "SELLER_DEVELOPER" }] as PersonaState[]));
  const act = async (persona: PersonaState) => {
    if (personaRequestInFlight.current || persona.type === activePersona) return;
    personaRequestInFlight.current = true;
    setError("");
    try {
      const targetPersona = customerPersonaForAnalytics(persona.type);
      const previousPersona = activePersona === "BUYER" || activePersona === "SELLER_DEVELOPER" ? customerPersonaForAnalytics(activePersona) : null;
      if (!persona.activated) void trackCustomerEvent("Persona Activation Started", { target_persona: targetPersona });
      const result = persona.activated ? await switchPersona.mutateAsync(persona.type) : await activate.mutateAsync(persona.type);
      const refreshedSession = await refreshSession();
      if (refreshedSession.activePersona !== result.data.activePersona) throw new Error("The active profile could not be refreshed.");
      queryClient.setQueryData(["personas"], {
        success: true,
        message: "Persona state synchronized",
        data: { activePersona: refreshedSession.activePersona, personas: refreshedSession.personas }
      });
      await queryClient.invalidateQueries({ queryKey: ["personas"], refetchType: "inactive" });
      await updateCustomerAnalyticsPersona(customerPersonaForAnalytics(result.data.activePersona));
      if (persona.activated && previousPersona) void trackCustomerEvent("Persona Switched", { from_persona: previousPersona, to_persona: customerPersonaForAnalytics(result.data.activePersona) });
      if (result.data.nextAction === "COMPLETE_BUYER_ONBOARDING" || result.data.nextAction === "COMPLETE_SELLER_ONBOARDING") prepareOnboardingAnalyticsTrigger({ persona: customerPersonaForAnalytics(result.data.activePersona), source: "persona_activation" });
      onClose();
      router.push(routeForNextAction(refreshedSession.nextAction));
    } catch (caught) {
      setError(apiErrorOf(caught).message);
    } finally {
      personaRequestInFlight.current = false;
    }
  };

  const signOut = async () => {
    if (logoutPending) return;
    await logout();
    onClose();
    router.replace("/marketplace");
    router.refresh();
  };

  return createPortal(<div className="persona-dialog-backdrop"><button type="button" className="persona-dialog-dismiss" aria-label="Close persona switcher backdrop" onClick={onClose} /><div ref={dialog} className="persona-dialog" role="dialog" aria-modal="true" aria-labelledby="persona-title"><header className="flex items-start justify-between p-5"><div><h2 id="persona-title" className="text-lg font-extrabold">Switch mode</h2><p className="mt-1 text-sm text-brand-muted">Use Beryl as a buyer, a seller, or both. Your account details stay the same.</p></div><button className="icon-button h-10 w-10" onClick={onClose} aria-label="Close persona switcher"><X size={20} /></button></header>{query.isLoading ? <div className="grid place-items-center p-10"><Spinner /></div> : null}{error ? <div className="px-5 pb-3"><ApiAlert>{error}</ApiAlert></div> : null}{personas.map((persona) => { const isActive = persona.type === activePersona; const Icon = persona.type === "BUYER" ? UserRound : Building2; const busy = activate.isPending || switchPersona.isPending; return <div className="persona-row" key={persona.type}><Icon size={25} aria-hidden /><div className="min-w-0 flex-1"><strong>{labels[persona.type].title}</strong><p className="text-xs text-brand-muted">{labels[persona.type].subtitle}</p></div>{isActive ? <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs text-green-800"><Check size={12} />Active</span> : <button className="btn btn-secondary min-h-9 px-3 text-xs" disabled={busy} onClick={() => act(persona)}>{busy ? <Spinner /> : persona.activated ? "Switch" : <><Plus size={14} />Activate</>}</button>}</div>; })}<footer className="persona-dialog-footer"><button type="button" className="persona-dialog-logout" disabled={logoutPending} onClick={() => void signOut()}><LogOut size={17} aria-hidden="true" />{logoutPending ? "Logging out…" : "Log out"}</button></footer></div></div>, document.body);
}
