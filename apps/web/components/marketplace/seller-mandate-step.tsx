"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiAlert, Spinner } from "@/components/ui/feedback";
import { customerApi } from "@/lib/api/client";
import { apiErrorOf } from "@/lib/api/errors";
import type { SellerSalesMandateInput } from "@/lib/contracts";
import { sellerListingRouteForAction } from "@/lib/seller-listings";
import { mandatePayload } from "@/lib/seller-w5";
import { sellerMandateSchema } from "@/lib/seller-wizard-validation";

export function SellerMandateStep({ propertyId, onBack }: { propertyId: string; onBack: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState("");
  const continueLocked = useRef(false);
  const manualSaveLocked = useRef(false);
  const query = useQuery({
    queryKey: ["seller-mandate", propertyId],
    queryFn: async () => {
      try {
        return await customerApi.sellerMandate(propertyId);
      } catch (error) {
        if (apiErrorOf(error).code === "MANDATE_NOT_FOUND") {
          return { success: true as const, message: "No saved Sales Mandate", data: { mandate: null } };
        }
        throw error;
      }
    },
    retry: false
  });
  const form = useForm<SellerSalesMandateInput>({
    resolver: zodResolver(sellerMandateSchema),
    defaultValues: { sellerFullName: "", ownershipConfirmed: false, mandateAccepted: false }
  });

  useEffect(() => {
    const mandate = query.data?.data.mandate;
    if (mandate) form.reset(mandatePayload(mandate));
  }, [form, query.data]);

  const saveMandate = useMutation({ mutationFn: (values: SellerSalesMandateInput) => customerApi.saveSellerMandate(propertyId, mandatePayload(values)) });
  const saveStepDraft = useMutation({ mutationFn: () => customerApi.saveSellerDraft(propertyId, { currentStep: "SALES_MANDATE" }) });
  const continueMutation = useMutation({
    mutationFn: async (values: SellerSalesMandateInput) => {
      await customerApi.saveSellerMandate(propertyId, mandatePayload(values));
      await customerApi.saveSellerDraft(propertyId, { currentStep: "REVIEW" });
    },
    onSuccess: () => router.push(sellerListingRouteForAction("CONTINUE_REVIEW", propertyId))
  });

  const manualSave = async () => {
    if (manualSaveLocked.current || saveMandate.isPending || saveStepDraft.isPending || continueMutation.isPending) return;
    manualSaveLocked.current = true;
    setApiError("");
    try {
      const values = form.getValues();
      const hasMandateValues = Boolean(values.mandateType || values.sellerFullName.trim() || values.ownershipConfirmed || values.mandateAccepted);
      if (hasMandateValues && (!values.mandateType || !values.sellerFullName.trim())) {
        await form.trigger(["mandateType", "sellerFullName"]);
        return;
      }
      if (hasMandateValues) await saveMandate.mutateAsync(values);
      else await saveStepDraft.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: ["seller-marketplace-listings"], refetchType: "none" });
      router.replace("/seller/listings");
    } catch (error) {
      setApiError(apiErrorOf(error).message || "We could not save the Sales Mandate.");
    } finally {
      manualSaveLocked.current = false;
    }
  };

  const continueToReview = form.handleSubmit(async (values) => {
    if (continueLocked.current) return;
    continueLocked.current = true;
    setApiError("");
    try {
      await continueMutation.mutateAsync(values);
    } catch (error) {
      const apiError = apiErrorOf(error);
      setApiError(apiError.code === "MANDATE_ACCEPTANCE_REQUIRED" ? "Accept the Sales Mandate before continuing." : "We could not continue to Review. Please try again.");
    } finally {
      continueLocked.current = false;
    }
  });

  if (query.isLoading) return <section className="seller-editor-card"><Spinner label="Loading Sales Mandate" /></section>;
  if (query.isError) return <section className="seller-editor-card"><ApiAlert>We could not restore the Sales Mandate.</ApiAlert><button className="btn btn-secondary" type="button" onClick={() => query.refetch()}>Try again</button></section>;

  const pending = saveMandate.isPending || saveStepDraft.isPending || continueMutation.isPending;
  return (
    <section className="seller-editor-card seller-mandate" aria-labelledby="sales-mandate-title">
      <div className="seller-editor-heading"><p className="seller-kicker">Step 3</p><h2 id="sales-mandate-title">Will you also use other agents?</h2><p>Choose the sales mandate that works for you.</p></div>
      {apiError ? <ApiAlert>{apiError}</ApiAlert> : null}
      <form onSubmit={continueToReview} noValidate>
        <fieldset id="seller-mandate-type" tabIndex={-1} aria-invalid={Boolean(form.formState.errors.mandateType) || undefined} aria-describedby={form.formState.errors.mandateType ? "seller-mandate-type-error" : undefined} className="seller-mandate-options">
          <legend>Mandate type <span className="seller-required-indicator" aria-hidden="true" /></legend>
          <label className={form.watch("mandateType") === "EXCLUSIVE" ? "is-selected" : ""}><input required type="radio" value="EXCLUSIVE" {...form.register("mandateType")} /><span><strong>Exclusive Sales Mandate</strong><small>Beryl Shelter will be the only agent marketing this property.</small></span></label>
          <label className={form.watch("mandateType") === "OPEN" ? "is-selected" : ""}><input required type="radio" value="OPEN" {...form.register("mandateType")} /><span><strong>Open Sales Mandate</strong><small>You may also market this property through other agents.</small></span></label>
          {form.formState.errors.mandateType ? <p id="seller-mandate-type-error" className="field-error" role="alert">{form.formState.errors.mandateType.message}</p> : null}
        </fieldset>
        <label className="seller-field" htmlFor="seller-full-name">Seller full name <span className="seller-required-indicator" aria-hidden="true" /><input id="seller-full-name" aria-label="Seller full name" required aria-invalid={Boolean(form.formState.errors.sellerFullName) || undefined} aria-describedby={form.formState.errors.sellerFullName ? "seller-full-name-error" : undefined} autoComplete="name" {...form.register("sellerFullName")} />{form.formState.errors.sellerFullName ? <span id="seller-full-name-error" className="field-error" role="alert">{form.formState.errors.sellerFullName.message}</span> : null}</label>
        <label className="seller-check" htmlFor="seller-ownership-confirmed"><input id="seller-ownership-confirmed" required aria-invalid={Boolean(form.formState.errors.ownershipConfirmed) || undefined} aria-describedby={form.formState.errors.ownershipConfirmed ? "seller-ownership-confirmed-error" : undefined} type="checkbox" {...form.register("ownershipConfirmed")} /><span>I confirm that I own this property or have authority to list it for sale.</span></label>
        {form.formState.errors.ownershipConfirmed ? <p id="seller-ownership-confirmed-error" className="field-error" role="alert">{form.formState.errors.ownershipConfirmed.message}</p> : null}
        <label className="seller-check" htmlFor="seller-mandate-accepted"><input id="seller-mandate-accepted" required aria-invalid={Boolean(form.formState.errors.mandateAccepted) || undefined} aria-describedby={form.formState.errors.mandateAccepted ? "seller-mandate-accepted-error" : undefined} type="checkbox" {...form.register("mandateAccepted")} /><span>I acknowledge and accept this Sales Mandate.</span></label>
        {form.formState.errors.mandateAccepted ? <p id="seller-mandate-accepted-error" className="field-error" role="alert">{form.formState.errors.mandateAccepted.message}</p> : null}
        <div className="seller-editor-actions seller-editor-footer-actions">
          <button className="btn btn-secondary" type="button" disabled={pending} onClick={() => void manualSave()}>{saveMandate.isPending || saveStepDraft.isPending ? "Saving…" : "Save as draft"}</button>
          <div><button className="btn btn-secondary" type="button" disabled={pending} onClick={onBack}>Back</button><button className="btn btn-primary" type="submit" disabled={pending}>{continueMutation.isPending ? "Saving…" : "Continue"}</button></div>
        </div>
      </form>
    </section>
  );
}
