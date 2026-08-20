"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ApiAlert, Spinner } from "@/components/ui/feedback";
import { customerApi } from "@/lib/api/client";
import { apiErrorOf } from "@/lib/api/errors";
import type { SellerSalesMandateInput } from "@/lib/contracts";
import { sellerListingRouteForAction } from "@/lib/seller-listings";
import { mandatePayload } from "@/lib/seller-w5";

const mandateSchema = z.object({
  mandateType: z.enum(["EXCLUSIVE", "OPEN"], {
    required_error: "Choose a mandate type.",
    invalid_type_error: "Choose a mandate type."
  }),
  sellerFullName: z.string().trim().min(2, "Enter the Seller's full name."),
  ownershipConfirmed: z.boolean().refine(Boolean, "Confirm that you own or are authorized to list this property."),
  mandateAccepted: z.boolean().refine(Boolean, "Accept the Sales Mandate before continuing.")
});

export function SellerMandateStep({ propertyId, onBack }: { propertyId: string; onBack: () => void }) {
  const router = useRouter();
  const [apiError, setApiError] = useState("");
  const query = useQuery({ queryKey: ["seller-mandate", propertyId], queryFn: () => customerApi.sellerMandate(propertyId) });
  const form = useForm<SellerSalesMandateInput>({
    resolver: zodResolver(mandateSchema),
    defaultValues: { sellerFullName: "", ownershipConfirmed: false, mandateAccepted: false }
  });

  useEffect(() => {
    const mandate = query.data?.data.mandate;
    if (mandate) form.reset(mandatePayload(mandate));
  }, [form, query.data]);

  const saveMandate = useMutation({ mutationFn: (values: SellerSalesMandateInput) => customerApi.saveSellerMandate(propertyId, mandatePayload(values)) });
  const continueMutation = useMutation({
    mutationFn: async (values: SellerSalesMandateInput) => {
      await customerApi.saveSellerMandate(propertyId, mandatePayload(values));
      await customerApi.saveSellerDraft(propertyId, { currentStep: "REVIEW" });
    },
    onSuccess: () => router.push(sellerListingRouteForAction("CONTINUE_REVIEW", propertyId))
  });

  const manualSave = async () => {
    setApiError("");
    const values = form.getValues();
    if (!values.mandateType || !values.sellerFullName.trim()) {
      await form.trigger(["mandateType", "sellerFullName"]);
      return;
    }
    try {
      await saveMandate.mutateAsync(values);
    } catch (error) {
      setApiError(apiErrorOf(error).message || "We could not save the Sales Mandate.");
    }
  };

  const continueToReview = form.handleSubmit(async (values) => {
    setApiError("");
    try {
      await continueMutation.mutateAsync(values);
    } catch (error) {
      const apiError = apiErrorOf(error);
      setApiError(apiError.code === "MANDATE_ACCEPTANCE_REQUIRED" ? "Accept the Sales Mandate before continuing." : "We could not continue to Review. Please try again.");
    }
  });

  if (query.isLoading) return <section className="seller-editor-card"><Spinner label="Loading Sales Mandate" /></section>;
  if (query.isError) return <section className="seller-editor-card"><ApiAlert>We could not restore the Sales Mandate.</ApiAlert><button className="btn btn-secondary" type="button" onClick={() => query.refetch()}>Try again</button></section>;

  const pending = saveMandate.isPending || continueMutation.isPending;
  return (
    <section className="seller-editor-card seller-mandate" aria-labelledby="sales-mandate-title">
      <div className="seller-editor-heading"><p className="seller-kicker">Step 3</p><h2 id="sales-mandate-title">Sales Mandate</h2><p>Choose how you want Beryl Shelter to market this property.</p></div>
      {apiError ? <ApiAlert>{apiError}</ApiAlert> : null}
      <form onSubmit={continueToReview} noValidate>
        <fieldset className="seller-mandate-options">
          <legend>Mandate type</legend>
          <label className={form.watch("mandateType") === "EXCLUSIVE" ? "is-selected" : ""}><input type="radio" value="EXCLUSIVE" {...form.register("mandateType")} /><span><strong>Exclusive Sales Mandate</strong></span></label>
          <label className={form.watch("mandateType") === "OPEN" ? "is-selected" : ""}><input type="radio" value="OPEN" {...form.register("mandateType")} /><span><strong>Open Sales Mandate</strong></span></label>
          {form.formState.errors.mandateType ? <p className="field-error" role="alert">{form.formState.errors.mandateType.message}</p> : null}
        </fieldset>
        <label className="seller-field">Seller full name<input autoComplete="name" {...form.register("sellerFullName")} />{form.formState.errors.sellerFullName ? <span className="field-error" role="alert">{form.formState.errors.sellerFullName.message}</span> : null}</label>
        <label className="seller-check"><input type="checkbox" {...form.register("ownershipConfirmed")} /><span>I confirm that I own this property or have authority to list it for sale.</span></label>
        {form.formState.errors.ownershipConfirmed ? <p className="field-error" role="alert">{form.formState.errors.ownershipConfirmed.message}</p> : null}
        <label className="seller-check"><input type="checkbox" {...form.register("mandateAccepted")} /><span>I acknowledge and accept this Sales Mandate.</span></label>
        {form.formState.errors.mandateAccepted ? <p className="field-error" role="alert">{form.formState.errors.mandateAccepted.message}</p> : null}
        <div className="seller-editor-actions">
          <button className="btn btn-secondary" type="button" disabled={pending} onClick={onBack}>Back</button>
          <button className="btn btn-secondary" type="button" disabled={pending} onClick={() => void manualSave()}>{saveMandate.isPending ? "Saving…" : "Save as draft"}</button>
          <button className="btn btn-primary" type="submit" disabled={pending}>{continueMutation.isPending ? "Saving…" : "Continue to Review"}</button>
        </div>
      </form>
    </section>
  );
}
