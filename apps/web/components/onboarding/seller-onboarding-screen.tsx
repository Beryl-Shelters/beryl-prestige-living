"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { OnboardingFrame } from "./onboarding-frame";
import { ApiAlert, Spinner } from "@/components/ui/feedback";
import { InputField, TextAreaField } from "@/components/ui/form-controls";
import { customerApi } from "@/lib/api/client";
import { apiErrorOf } from "@/lib/api/errors";
import {
  sellerOnboardingSchema,
  type SellerOnboardingValues,
} from "@/lib/validation";
import { trackCustomerEvent } from "@/lib/analytics/customer";

export function SellerOnboardingScreen() {
  const router = useRouter();
  const [error, setError] = useState("");
  const form = useForm<SellerOnboardingValues>({
    resolver: zodResolver(sellerOnboardingSchema),
    defaultValues: {
      profileType: "INDIVIDUAL",
      companyName: "",
      companyAddress: "",
    },
  });
  const profileType = form.watch("profileType");
  const mutation = useMutation({ mutationFn: customerApi.sellerOnboarding });
  const complete = async (
    body: Parameters<typeof customerApi.sellerOnboarding>[0],
  ) => {
    setError("");
    try {
      await mutation.mutateAsync(body);
      router.replace("/seller");
    } catch (caught) {
      setError(apiErrorOf(caught).message);
    }
  };
  const submit = form.handleSubmit((values) => {
    void trackCustomerEvent("Seller Onboarding Completed", {
      profile_type:
        values.profileType === "BUSINESS" ? "Business" : "Individual",
      company_name_provided: Boolean(values.companyName?.trim()),
      company_address_provided: Boolean(values.companyAddress?.trim()),
    });
    return complete(
      values.profileType === "BUSINESS"
        ? {
            profileType: "BUSINESS",
            companyName: values.companyName?.trim(),
            companyAddress: values.companyAddress?.trim(),
          }
        : { profileType: "INDIVIDUAL" },
    );
  });
  return (
    <OnboardingFrame label="Seller onboarding" intent="LIST_PROPERTY">
      <div className="flex justify-end">
        <button
          className="btn btn-quiet"
          type="button"
          onClick={() => complete({ skip: true })}
        >
          Skip
        </button>
      </div>
      <h1 className="page-title mt-2">Set up your seller profile</h1>
      <p className="page-copy">
        This helps us present your listings the right way.
      </p>
      <form onSubmit={submit}>
        <fieldset>
          <legend className="field-label mb-2">Who are you listing as?</legend>
          <div className="grid gap-2">
            <button
              type="button"
              className="choice-card justify-start"
              data-selected={profileType === "INDIVIDUAL"}
              aria-pressed={profileType === "INDIVIDUAL"}
              onClick={() => form.setValue("profileType", "INDIVIDUAL")}
            >
              <UserRound size={22} />
              <span className="text-left">
                <strong className="block">An individual</strong>
                <small className="text-brand-muted">
                  I&apos;m selling my own property.
                </small>
              </span>
            </button>
            <button
              type="button"
              className="choice-card justify-start"
              data-selected={profileType === "BUSINESS"}
              aria-pressed={profileType === "BUSINESS"}
              onClick={() => form.setValue("profileType", "BUSINESS")}
            >
              <Building2 size={22} />
              <span className="text-left">
                <strong className="block">A business</strong>
                <small className="text-brand-muted">
                  I&apos;m a developer, agency or company.
                </small>
              </span>
            </button>
          </div>
        </fieldset>
        <div className="form-stack mt-3">
          {profileType === "BUSINESS" ? (
            <>
              <InputField
                label="Company name"
                error={form.formState.errors.companyName?.message}
                {...form.register("companyName")}
              />
              <TextAreaField
                label="Company address"
                error={form.formState.errors.companyAddress?.message}
                {...form.register("companyAddress")}
              />
            </>
          ) : null}
          {error ? <ApiAlert>{error}</ApiAlert> : null}
        </div>
        <div className="onboarding-actions">
          <button className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Spinner />
                Saving…
              </>
            ) : profileType === "BUSINESS" ? (
              "List as company"
            ) : (
              "Continue"
            )}
          </button>
          <button
            className="btn btn-quiet"
            type="button"
            onClick={() => complete({ skip: true })}
          >
            Skip for now
          </button>
        </div>
      </form>
    </OnboardingFrame>
  );
}
