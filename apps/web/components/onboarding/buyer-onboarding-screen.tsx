"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { OnboardingFrame } from "./onboarding-frame";
import { LocationSearch } from "./location-search";
import { ApiAlert, Spinner } from "@/components/ui/feedback";
import { InputField } from "@/components/ui/form-controls";
import { customerApi } from "@/lib/api/client";
import { apiErrorOf } from "@/lib/api/errors";
import { buyerOnboardingSchema, type BuyerOnboardingValues } from "@/lib/validation";
import { trackCustomerEvent } from "@/lib/analytics/customer";

const CURRENCY_SYMBOLS = { NGN: "₦", USD: "$", GBP: "£", EUR: "€" } as const;

export function BuyerOnboardingScreen() {
  const router = useRouter();
  const [error, setError] = useState("");
  const form = useForm<BuyerOnboardingValues>({ resolver: zodResolver(buyerOnboardingSchema), defaultValues: { preferredLocations: [], budgetMin: "", budgetMax: "", currency: "NGN" } });
  const currencySymbol = CURRENCY_SYMBOLS[form.watch("currency")];
  const mutation = useMutation({ mutationFn: customerApi.buyerOnboarding });
  const complete = async (body: Parameters<typeof customerApi.buyerOnboarding>[0]) => { setError(""); try { await mutation.mutateAsync(body); router.replace("/buyer"); } catch (caught) { setError(apiErrorOf(caught).message); } };
  const submit = form.handleSubmit((values) => { const budgetProvided = Boolean(values.budgetMin || values.budgetMax); void trackCustomerEvent("Buyer Onboarding Completed", { preferred_locations: values.preferredLocations, budget_provided: budgetProvided, skipped_budget: false }); return complete({ preferredLocations: values.preferredLocations, ...(values.budgetMin ? { budgetMin: Number(values.budgetMin.replaceAll(",", "")) } : {}), ...(values.budgetMax ? { budgetMax: Number(values.budgetMax.replaceAll(",", "")) } : {}), currency: values.currency }); });
  return <OnboardingFrame label="Buyer onboarding"><div className="flex justify-end"><button className="btn btn-quiet" type="button" onClick={() => complete({ skip: true })}>Skip</button></div><h1 className="page-title mt-2">Hello there 👋🏽. Answer these questions to get you started</h1><p className="page-copy">We&apos;ll tailor your home feed. You can change this anytime.</p><form onSubmit={submit}><div className="form-stack"><Controller control={form.control} name="preferredLocations" render={({ field }) => <LocationSearch selected={field.value} onChange={field.onChange} />} />{form.formState.errors.preferredLocations?.message ? <p className="field-error">{form.formState.errors.preferredLocations.message}</p> : null}<fieldset><legend className="field-label mb-2">Set your budget (Optional)</legend><div className="grid grid-cols-[1fr_1fr_auto] gap-2"><InputField id="budget-min" label="Minimum" inputMode="numeric" placeholder="Min" prefix={currencySymbol} error={form.formState.errors.budgetMin?.message} {...form.register("budgetMin")} /><InputField id="budget-max" label="Maximum" inputMode="numeric" placeholder="Max" prefix={currencySymbol} error={form.formState.errors.budgetMax?.message} {...form.register("budgetMax")} /><div className="field-wrap"><label className="field-label" htmlFor="currency">Currency</label><select id="currency" className="form-control" {...form.register("currency")}><option>NGN</option><option>USD</option><option>GBP</option><option>EUR</option></select></div></div></fieldset>{error ? <ApiAlert>{error}</ApiAlert> : null}</div><div className="onboarding-actions"><button className="btn btn-primary" disabled={mutation.isPending}>{mutation.isPending ? <><Spinner />Saving…</> : <><Search size={17} />Find a property</>}</button><button className="btn btn-quiet" type="button" onClick={() => complete({ skip: true })}>Pick at least one area to continue, or skip this process</button></div></form></OnboardingFrame>;
}
