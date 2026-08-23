"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronDown, Cloud, FileText, Images, KeyRound, Minus, Plus, Upload, X } from "lucide-react";
import { BerylShelterLogo } from "@/components/brand/beryl-shelter-logo";
import { ApiAlert } from "@/components/ui/feedback";
import { customerApi } from "@/lib/api/client";
import { apiErrorOf } from "@/lib/api/errors";
import type { SellerDraft, SellerSubmissionResult } from "@/lib/contracts";
import { sellerPropertyTypes } from "@/lib/marketplace-property-options";
import { formatNumericInput, numericInputValue } from "@/lib/numeric-input";
import { continueSellerDraftToSalesMandate } from "@/lib/seller-draft-transition";
import { toSellerDraftPayload } from "@/lib/seller-draft-payload";
import { sellerListingRouteForAction } from "@/lib/seller-listings";
import { SellerMandateStep } from "./seller-mandate-step";
import { SellerReviewStep, SellerSubmissionSuccess } from "./seller-review-step";
import { SellerShell } from "./seller-shell";
import { SellerDeleteDraftDialog } from "./seller-delete-draft-dialog";

type EditorStep = "PROPERTY_INFORMATION" | "PHOTOS_DOCUMENTS" | "SALES_MANDATE" | "REVIEW";

const empty: Partial<SellerDraft> = {
  propertyCategory: "RESIDENTIAL",
  negotiable: false,
  amenities: [],
  currentStep: "PROPERTY_INFORMATION"
};
const amenityOptions = ["Security", "Swimming pool", "Generator", "Gym", "Balcony", "CCTV"];

const sellerDraftErrorMessage = (error: unknown) => {
  const apiError = apiErrorOf(error);
  const fields = apiError.errors?.fieldErrors ?? {};
  if (fields.propertyType?.length) return "Select a supported property type.";
  if (fields.propertyCategory?.length) return "Select Residential or Commercial.";
  if (fields.ownershipType?.length) return "Select a supported ownership type.";
  if (fields.askingPrice?.length) return "Enter a valid non-negative asking price.";
  if (fields.initialDepositValue?.length || fields.initialDepositType?.length) return "Check the initial deposit type and value.";
  if (apiError.code === "SELLER_PERSONA_REQUIRED") return "Switch to a completed Seller profile before creating a listing.";
  if (apiError.code === "INVALID_DRAFT_PAYLOAD") return "Check the property information and try again.";
  if (apiError.code === "DRAFT_PERSISTENCE_UNAVAILABLE") return "We couldn’t save this property draft right now. Please try again.";
  if (apiError.code === "NETWORK_ERROR" || apiError.code === "UPSTREAM_UNAVAILABLE") return "We couldn’t connect to save your draft. Please try again.";
  return "We couldn’t save this property draft. Please try again.";
};

export function SellerDraftEditor({
  propertyId: initialId,
  initialStep
}: {
  propertyId?: string;
  initialStep?: EditorStep;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [id, setId] = useState(initialId);
  const [step, setStep] = useState<EditorStep>(initialStep ?? "PROPERTY_INFORMATION");
  const [draft, setDraft] = useState<Partial<SellerDraft>>(empty);
  const [custom, setCustom] = useState("");
  const [status, setStatus] = useState("");
  const hydrated = useRef(false);
  const savedSnapshot = useRef("");
  const saveSequence = useRef(0);
  const idRef = useRef(initialId);
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());
  const pendingWrites = useRef(0);
  const [pending, setPending] = useState(false);
  const [submission, setSubmission] = useState<SellerSubmissionResult | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const restored = useQuery({
    queryKey: ["seller-draft", id],
    queryFn: () => customerApi.sellerDraft(id!),
    enabled: Boolean(id) && !submission
  });
  const correction = useQuery({
    queryKey: ["seller-marketplace-management", id],
    queryFn: () => customerApi.sellerListingManagement(id!),
    enabled: Boolean(id) && !submission
  });
  const deleteMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      await writeQueue.current.catch(() => undefined);
      return customerApi.deleteSellerDraft(propertyId);
    },
    onSuccess: async () => {
      setDeleteOpen(false);
      setDeleteError("");
      await queryClient.invalidateQueries({ queryKey: ["seller-marketplace-listings"] });
      queryClient.removeQueries({ queryKey: ["seller-draft", id] });
      queryClient.removeQueries({ queryKey: ["seller-marketplace-management", id] });
      queryClient.removeQueries({ queryKey: ["seller-review", id] });
      router.replace("/seller/listings");
    },
    onError: () => setDeleteError("We could not delete this draft. Please try again.")
  });

  const correctionSummary = correction.data?.data.management.summary;
  const transitionedListing = Boolean(restored.isError && correctionSummary && correctionSummary.status !== "DRAFT");

  useEffect(() => {
    if (!transitionedListing || !correctionSummary || !id) return;
    router.replace(sellerListingRouteForAction(correctionSummary.nextAction, id));
  }, [correctionSummary, id, router, transitionedListing]);

  useEffect(() => {
    const property = restored.data?.data.property;
    if (!property) return;

    setDraft(property);
    setStep(initialStep ?? normalizeStep(property.currentStep));
    idRef.current = property.id;
    savedSnapshot.current = JSON.stringify(toSellerDraftPayload(property));
    hydrated.current = true;
  }, [initialStep, restored.data]);

  useEffect(() => {
    if (initialId) return;
    savedSnapshot.current = JSON.stringify(toSellerDraftPayload(empty));
    hydrated.current = true;
  }, [initialId]);

  const persist = useCallback((next: Partial<SellerDraft>) => {
    const payload = toSellerDraftPayload(next);
    pendingWrites.current += 1;
    setPending(true);
    const operation = writeQueue.current.catch(() => undefined).then(async () => {
      const currentId = idRef.current;
      if (currentId) return customerApi.saveSellerDraft(currentId, payload);

      const created = await customerApi.createSellerDraft(payload);
      const createdId = created.data.property.id;
      if (!createdId) throw new Error("Draft response did not include a property ID");
      idRef.current = createdId;
      setId(createdId);
      router.replace(`/seller/listings/${createdId}/edit` as Route);
      return created;
    });
    writeQueue.current = operation.then(
      () => undefined,
      () => undefined
    ).finally(() => {
      pendingWrites.current -= 1;
      if (pendingWrites.current === 0) setPending(false);
    });
    return operation;
  }, [router]);

  const save = async (next: Partial<SellerDraft> = draft) => {
    const sequence = ++saveSequence.current;
    const snapshot = JSON.stringify(toSellerDraftPayload(next));
    setStatus("Saving…");
    try {
      await persist(next);
      if (sequence === saveSequence.current) {
        savedSnapshot.current = snapshot;
        setStatus("Saved");
      }
      return true;
    } catch (error) {
      if (sequence === saveSequence.current) setStatus(sellerDraftErrorMessage(error));
      return false;
    }
  };

  const change = (key: keyof SellerDraft, value: unknown) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    if (!hydrated.current || step !== "PROPERTY_INFORMATION") return;
    const payload = toSellerDraftPayload(draft);
    const snapshot = JSON.stringify(payload);
    if (snapshot === savedSnapshot.current) return;

    const timer = window.setTimeout(async () => {
      if (snapshot === savedSnapshot.current) return;
      const sequence = ++saveSequence.current;
      setStatus("Saving…");
      try {
        await persist(draft);
        if (sequence === saveSequence.current) {
          savedSnapshot.current = snapshot;
          setStatus("Saved");
        }
      } catch (error) {
        if (sequence === saveSequence.current) setStatus(sellerDraftErrorMessage(error));
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [draft, persist, step]);

  const continueStepOne = async () => {
    if (
      !draft.title?.trim() ||
      !draft.propertyCategory ||
      !draft.propertyType ||
      !draft.publicLocation?.trim() ||
      !draft.fullAddress?.trim() ||
      draft.askingPrice === undefined
    ) {
      setStatus("Complete the required property information before continuing.");
      return;
    }

    if (!(await save(draft))) return;
    const next = { ...draft, currentStep: "PHOTOS_DOCUMENTS" as const };
    if (await save(next)) {
      setDraft(next);
      setStep("PHOTOS_DOCUMENTS");
    }
  };

  const addAmenity = () => {
    const value = custom.trim();
    if (!value || draft.amenities?.some((amenity) => amenity.toLowerCase() === value.toLowerCase())) return;
    change("amenities", [...(draft.amenities ?? []), value]);
    setCustom("");
  };

  if (submission) {
    return <main className="seller-submit-page"><SellerSubmissionSuccess submission={submission} /></main>;
  }
  if (initialId && !restored.data && (restored.isLoading || correction.isLoading)) {
    return <SellerListingLoader />;
  }
  if (restored.isError) {
    if (transitionedListing) return <SellerListingLoader message="Opening listing status…" />;
    const draftCode = apiErrorOf(restored.error).code;
    const managementCode = apiErrorOf(correction.error).code;
    const genuinelyMissing = draftCode === "PROPERTY_NOT_FOUND" && managementCode === "PROPERTY_NOT_FOUND";
    return <main className="seller-listings-page"><section className="seller-listing-state"><ApiAlert>{genuinelyMissing ? "This property could not be found." : "We could not load this listing right now."}</ApiAlert><Link className="btn btn-secondary" href="/seller/listings">Back to My Listings</Link></section></main>;
  }

  const stepNumber = step === "PROPERTY_INFORMATION" ? 1 : step === "PHOTOS_DOCUMENTS" ? 2 : step === "SALES_MANDATE" ? 3 : 4;
  const usesSellerShell = Boolean(correctionSummary && (correctionSummary.status === "LIVE" || correctionSummary.status === "REJECTED" || correctionSummary.rejectionFeedback || correctionSummary.rejectionReason));
  const editor = (
    <main className="seller-listings-page seller-editor">
      {usesSellerShell ? <header className="seller-edit-header"><h1>Edit this property</h1><nav aria-label="Property edit sections"><button type="button" className={step === "PROPERTY_INFORMATION" ? "is-active" : ""} onClick={() => setStep("PROPERTY_INFORMATION")}>Property Details</button><button type="button" className={step === "PHOTOS_DOCUMENTS" ? "is-active" : ""} onClick={() => setStep("PHOTOS_DOCUMENTS")}>Photos</button><button type="button" onClick={() => setStep("PHOTOS_DOCUMENTS")}>Documents</button></nav></header> : <header className="seller-editor-header">
        <div className="seller-editor-topline"><strong>Property Info.</strong><span className="sr-only">Step {stepNumber} of 4</span><span><Cloud size={15} />{status || "Progress saves as you go"}</span></div>
        <div className="seller-stepper">
          <span className={step === "PROPERTY_INFORMATION" ? "active" : "done"}><i>{stepNumber > 1 ? <Check size={13} /> : 1}</i>Property Info.</span>
          <span className={step === "PHOTOS_DOCUMENTS" ? "active" : stepNumber > 2 ? "done" : ""}><i>{stepNumber > 2 ? <Check size={13} /> : 2}</i>Photos &amp; Documents</span>
          <span className={step === "SALES_MANDATE" ? "active" : stepNumber > 3 ? "done" : ""}><i>{stepNumber > 3 ? <Check size={13} /> : 3}</i>Sales Mandate</span>
          <span className={step === "REVIEW" ? "active" : ""}><i>4</i>Review</span>
        </div>
      </header>}
      {id && restored.data?.data.property ? <div className="seller-editor-delete-row"><button type="button" className="seller-editor-delete-action" disabled={pending || deleteMutation.isPending} onClick={() => { setDeleteError(""); setDeleteOpen(true); }}>Delete draft</button></div> : null}
      {correction.data?.data.management.summary.rejectionFeedback || correction.data?.data.management.summary.rejectionReason ? <section className="seller-correction-context" aria-labelledby="correction-context-title"><p className="seller-kicker">Correction context</p><h2 id="correction-context-title">Changes needed</h2><p>{correction.data.data.management.summary.rejectionFeedback || correction.data.data.management.summary.rejectionReason}</p></section> : null}
      <div className={`seller-editor-workspace${step === "REVIEW" ? " is-review" : ""}`}>
      {step === "PROPERTY_INFORMATION" ? (
        <PropertyInformationStep
          draft={draft}
          customAmenity={custom}
          pending={pending}
          onChange={change}
          onCustomAmenityChange={setCustom}
          onAddAmenity={addAmenity}
          onSave={() => void save()}
          onBack={() => router.push("/seller/listings")}
          onContinue={() => void continueStepOne()}
        />
      ) : step === "PHOTOS_DOCUMENTS" ? (
        <MediaStep propertyId={id!} draft={draft} onBack={() => setStep("PROPERTY_INFORMATION")} />
      ) : step === "SALES_MANDATE" ? (
        <SellerMandateStep propertyId={id!} onBack={() => setStep("PHOTOS_DOCUMENTS")} />
      ) : <SellerReviewStep propertyId={id!} onSubmitted={setSubmission} />}
      {step !== "REVIEW" && !usesSellerShell ? <ListingHelper /> : null}
      </div>
      <SellerDeleteDraftDialog open={deleteOpen} pending={deleteMutation.isPending} error={deleteError} onCancel={() => { if (!deleteMutation.isPending) { setDeleteOpen(false); setDeleteError(""); } }} onConfirm={() => { if (id && !deleteMutation.isPending) deleteMutation.mutate(id); }} />
    </main>
  );
  return usesSellerShell ? <SellerShell>{editor}</SellerShell> : editor;
}

export function SellerListingLoader({ message = "Loading listing…" }: { message?: string }) {
  return <main className="seller-listing-loader" role="status" aria-live="polite"><BerylShelterLogo className="seller-loading-brand" /><p>{message}</p></main>;
}

function ListingHelper() {
  return <aside className="seller-listing-helper" aria-label="Listing steps"><Building2 size={34} aria-hidden="true" /><h2>Listing your property is straightforward</h2><ol><li><span>1</span>Tell us about the property</li><li><span>2</span>Add photos &amp; documents</li><li><span>3</span>Agree the sales mandate</li><li><span>4</span>Review and submit</li></ol><p><KeyRound size={15} />Your full address and documents stay private.</p><p><Images size={15} />Add clear photos to attract more interest.</p><p><FileText size={15} />You can save and return at any time.</p></aside>;
}

function normalizeStep(step: SellerDraft["currentStep"]): EditorStep {
  return step === "PHOTOS_DOCUMENTS" || step === "SALES_MANDATE" || step === "REVIEW" ? step : "PROPERTY_INFORMATION";
}

export function PropertyInformationStep({
  draft,
  customAmenity,
  pending,
  onChange,
  onCustomAmenityChange,
  onAddAmenity,
  onSave,
  onBack,
  onContinue
}: {
  draft: Partial<SellerDraft>;
  customAmenity: string;
  pending: boolean;
  onChange: (key: keyof SellerDraft, value: unknown) => void;
  onCustomAmenityChange: (value: string) => void;
  onAddAmenity: () => void;
  onSave: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const setDepositType = (value: "AMOUNT" | "PERCENTAGE" | null) => {
    onChange("initialDepositType", value);
    if (value === null) onChange("initialDepositValue", null);
  };
  const selectedAmenities = draft.amenities ?? [];
  return (
    <section className="seller-editor-card seller-property-form">
      <CollapsibleSection title="Tell us about the property" sectionId="property-basics">
        <label className="seller-field">Property Title<input placeholder="Enter property title here" value={draft.title ?? ""} onChange={(event) => onChange("title", event.target.value)} /></label>
        <label className="seller-field">Property Type<select value={draft.propertyType ?? ""} onChange={(event) => onChange("propertyType", event.target.value || undefined)}><option value="">Select property type</option>{sellerPropertyTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="seller-field">Description<textarea placeholder="Describe the property" value={draft.description ?? ""} onChange={(event) => onChange("description", event.target.value)} /></label>
        <ChoiceGroup legend="Category" value={draft.propertyCategory} options={[["RESIDENTIAL", "Residential", "A home, flat or apartment"], ["COMMERCIAL", "Commercial", "An office or business property"]]} onSelect={(value) => onChange("propertyCategory", value)} />
        <ChoiceGroup legend="Ownership" value={draft.ownershipType} stacked options={[["PERSONAL", "Personal", "I own this property."], ["THIRD_PARTY", "Third party", "I’m listing on the owner’s behalf."]]} onSelect={(value) => onChange("ownershipType", value)} />
      </CollapsibleSection>
      <CollapsibleSection title="Tell us about the location" sectionId="property-location">
        <label className="seller-field">Location<input placeholder="Where is the property located?" value={draft.publicLocation ?? ""} onChange={(event) => onChange("publicLocation", event.target.value)} /></label>
        <label className="seller-field">Full address<textarea placeholder="Enter the complete property address" value={draft.fullAddress ?? ""} onChange={(event) => onChange("fullAddress", event.target.value)} /></label>
        <p className="seller-privacy-note"><KeyRound size={16} aria-hidden="true" />The full address stays private and is only shared when appropriate.</p>
      </CollapsibleSection>
      <CollapsibleSection title="Let’s discuss pricing" sectionId="property-pricing">
        <label className="seller-field">Asking price<div className="seller-money-input"><span>₦</span><input aria-label="Asking price" inputMode="numeric" pattern="[0-9,]*" type="text" placeholder="Enter amount here" value={formatNumericInput(draft.askingPrice)} onChange={(event) => onChange("askingPrice", numericInputValue(event.target.value) ?? undefined)} /></div></label>
        <ChoiceGroup legend="Is the price negotiable?" value={draft.negotiable ? "YES" : "NO"} options={[["YES", "Yes, negotiable"], ["NO", "No, fixed price"]]} onSelect={(value) => onChange("negotiable", value === "YES")} />
        <ChoiceGroup legend="Initial deposit" value={draft.initialDepositType ?? "NONE"} options={[["NONE", "None"], ["AMOUNT", "Amount"], ["PERCENTAGE", "Percentage"]]} onSelect={(value) => setDepositType(value === "NONE" ? null : value as "AMOUNT" | "PERCENTAGE")} compact />
        {draft.initialDepositType ? <label className="seller-field">{draft.initialDepositType === "AMOUNT" ? "Deposit amount" : "Deposit percentage"}<div className="seller-money-input"><span>{draft.initialDepositType === "AMOUNT" ? "₦" : "%"}</span><input aria-label={draft.initialDepositType === "AMOUNT" ? "Deposit amount" : "Deposit percentage"} inputMode="numeric" pattern="[0-9,]*" type="text" value={formatNumericInput(draft.initialDepositValue)} onChange={(event) => onChange("initialDepositValue", numericInputValue(event.target.value))} /></div></label> : null}
      </CollapsibleSection>
      <CollapsibleSection title="Give us more details about the property" sectionId="property-details">
        <div className="seller-counter-grid">
          {draft.propertyCategory === "COMMERCIAL" ? <><CounterField label="Number of floors" field="numberOfFloors" value={draft.numberOfFloors} onChange={onChange} /><CounterField label="Parking capacity" field="parkingCapacity" value={draft.parkingCapacity} onChange={onChange} /></> : <><CounterField label="Bedrooms" field="bedrooms" value={draft.bedrooms} onChange={onChange} /><CounterField label="Bathrooms" field="bathrooms" value={draft.bathrooms} onChange={onChange} /><CounterField label="Toilets" field="toilets" value={draft.toilets} onChange={onChange} /><CounterField label="Parking spaces" field="parkingSpaces" value={draft.parkingSpaces} onChange={onChange} /></>}
        </div>
        <ChoiceGroup legend="Condition" value={draft.condition} options={[["OFF_PLAN", "Off Plan"], ["UNDER_CONSTRUCTION", "Under Construction"], ["NEWLY_BUILT", "Newly Built"], ["FAIRLY_USED", "Fairly Used"]]} onSelect={(value) => onChange("condition", value)} compact />
        <ChoiceGroup legend="Furnishing" value={draft.furnishing ?? undefined} options={[["UNFURNISHED", "Unfurnished"], ["SEMI_FURNISHED", "Semi Furnished"], ["FULLY_FURNISHED", "Fully Furnished"]]} onSelect={(value) => onChange("furnishing", value)} compact />
        <div className="seller-amenities-field">
          <strong>Amenities</strong>
          {selectedAmenities.length ? <div className="seller-selected-amenities">{selectedAmenities.map((amenity) => <span key={amenity}>{amenity}<button type="button" aria-label={`Remove ${amenity}`} onClick={() => onChange("amenities", selectedAmenities.filter((item) => item !== amenity))}><X size={14} /></button></span>)}</div> : null}
          <span className="seller-field-hint">Select available features</span>
          <div className="seller-amenity-suggestions">{amenityOptions.filter((amenity) => !selectedAmenities.includes(amenity)).map((amenity) => <button type="button" key={amenity} onClick={() => onChange("amenities", [...selectedAmenities, amenity])}><Plus size={14} />{amenity}</button>)}</div>
          <div className="seller-custom-amenity"><input aria-label="Custom amenity" value={customAmenity} onChange={(event) => onCustomAmenityChange(event.target.value)} placeholder="Add another amenity" /><button className="btn btn-secondary" type="button" onClick={onAddAmenity}>Add</button></div>
        </div>
      </CollapsibleSection>
      <div className="seller-editor-actions seller-editor-footer-actions">
        <button className="btn btn-secondary" type="button" disabled={pending} onClick={onSave}>Save as draft</button>
        <div><button className="btn btn-secondary" type="button" disabled={pending} onClick={onBack}>Back</button><button className="btn btn-primary" type="button" disabled={pending} onClick={onContinue}>Continue</button></div>
      </div>
    </section>
  );
}

function CollapsibleSection({ title, sectionId, children }: { title: string; sectionId: string; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  return <section className="seller-form-section"><h2><button className="seller-section-toggle" type="button" aria-expanded={expanded} aria-controls={sectionId} onClick={() => setExpanded((value) => !value)}><span>{title}</span><ChevronDown size={20} className={expanded ? "is-open" : ""} /></button></h2><div id={sectionId} hidden={!expanded} className="seller-section-content">{children}</div></section>;
}

function ChoiceGroup({ legend, value, options, onSelect, stacked = false, compact = false }: { legend: string; value?: string | boolean | null; options: ReadonlyArray<readonly [string, string, string?]>; onSelect: (value: string) => void; stacked?: boolean; compact?: boolean }) {
  return <fieldset className={`seller-choice-group${stacked ? " is-stacked" : ""}${compact ? " is-compact" : ""}`}><legend>{legend}</legend><div>{options.map(([machineValue, label, note]) => <label key={machineValue} className={value === machineValue ? "is-selected" : ""}><input type="radio" name={legend.replace(/\s/g, "-").toLowerCase()} value={machineValue} checked={value === machineValue} onChange={() => onSelect(machineValue)} /><span><strong>{label}</strong>{note ? <small>{note}</small> : null}</span></label>)}</div></fieldset>;
}

function CounterField({ label, field, value, onChange }: { label: string; field: keyof SellerDraft; value?: number | null; onChange: (key: keyof SellerDraft, value: unknown) => void }) {
  const count = value ?? 0;
  return <div className="seller-counter"><span>{label}</span><div><button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={count <= 0} onClick={() => onChange(field, Math.max(0, count - 1))}><Minus size={16} /></button><output aria-live="polite">{count}</output><button type="button" aria-label={`Increase ${label.toLowerCase()}`} onClick={() => onChange(field, count + 1)}><Plus size={16} /></button></div></div>;
}

function MediaStep({ propertyId, draft, onBack }: { propertyId: string; draft: Partial<SellerDraft>; onBack: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState("DEED");
  const refresh = () => location.reload();

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) || files.length + (draft.images?.length ?? 0) > 10) {
      setError("Use up to ten JPEG, PNG, or WEBP images, each up to 5MB.");
      return;
    }
    setBusy(true);
    const body = new FormData();
    files.forEach((file) => body.append("images", file));
    try {
      await customerApi.uploadSellerImages(propertyId, body);
      refresh();
    } catch {
      setError("Image upload failed. Please try again.");
      setBusy(false);
    }
  };

  const continueToSalesMandate = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      await continueSellerDraftToSalesMandate(propertyId, customerApi.saveSellerDraft, router.push);
    } catch {
      setError("We could not continue to the Sales Mandate step. Please try again.");
      setBusy(false);
    }
  };

  const saveMediaDraft = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      await customerApi.saveSellerDraft(propertyId, { currentStep: "PHOTOS_DOCUMENTS" });
      setBusy(false);
    } catch {
      setError("We could not save this draft. Please try again.");
      setBusy(false);
    }
  };

  const images = [...(draft.images ?? [])].sort((first, second) => first.order - second.order);
  return (
    <section className="seller-editor-card seller-media-step">
      <div className="seller-editor-heading"><p className="seller-kicker">Step 2</p><h2>Add some photos of the property to show buyers</h2><p>Add at least one clear photo. You can add up to ten photos and rearrange them at any time.</p></div>
      {error ? <ApiAlert>{error}</ApiAlert> : null}
      <label className="seller-upload-dropzone"><Upload size={24} aria-hidden="true" /><strong>Add Photos</strong><span>JPEG, PNG or WEBP · 5MB each</span><input disabled={busy || images.length >= 10} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={upload} /></label>
      <p className="seller-upload-count">{images.length}/10 photos</p>
      {images.length ? (
        <div className="seller-media-grid">
          {images.map((image, index) => (
            <article key={image.id}>
              <Image src={image.url} alt={`Property photo ${index + 1}`} width={640} height={420} />
              <strong>{image.isCover ? "Cover" : `Photo ${index + 1}`}</strong>
              <div>
                <button disabled={busy || index === 0} type="button" onClick={async () => { setBusy(true); await customerApi.reorderSellerImages(propertyId, [...images.slice(0, index - 1), image, images[index - 1], ...images.slice(index + 1)].map((item) => item.id)); refresh(); }}>Move left</button>
                {!image.isCover ? <button disabled={busy} type="button" onClick={async () => { setBusy(true); await customerApi.setSellerCover(propertyId, image.id); refresh(); }}>Set as cover</button> : null}
                <button disabled={busy} type="button" onClick={async () => { setBusy(true); await customerApi.deleteSellerImage(propertyId, image.id); refresh(); }}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      ) : <p className="seller-empty-media">No photos yet. Add a photo to begin.</p>}
      <p className="seller-media-hint">Drag or use the controls to arrange your photos. Choose one cover image.</p>
      <div className="seller-documents-heading"><h3>Add supporting documents</h3><p>Documents are optional, private, and never shown on the public listing.</p></div>
      <label className="seller-field">Document type<select value={type} onChange={(event) => setType(event.target.value)}><option value="DEED">Deed</option><option value="SURVEY_PLAN">Survey plan</option><option value="OWNERSHIP_PAPERS">Ownership papers</option><option value="CERTIFICATE_OF_OCCUPANCY">Certificate of occupancy</option><option value="OTHER">Other</option></select></label>
      <label className="seller-upload-dropzone"><FileText size={24} aria-hidden="true" /><strong>Upload supporting document</strong><span>PDF · 10MB maximum</span><input disabled={busy} type="file" accept="application/pdf" onChange={async (event) => {
        const file = event.target.files?.[0];
        if (!file || file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) { setError("Use a PDF up to 10MB."); return; }
        setBusy(true);
        const body = new FormData();
        body.append("document", file);
        body.append("documentType", type);
        body.append("displayName", file.name);
        try { await customerApi.uploadSellerDocument(propertyId, body); refresh(); } catch { setError("Document upload failed. Please try again."); setBusy(false); }
      }} /></label>
      {draft.documents?.length ? <ul className="seller-document-list">{draft.documents.map((document) => <li key={document.id}><FileText size={18} /><span><strong>{document.displayName}</strong><small>{document.documentType}</small></span><button aria-label={`Delete ${document.displayName}`} disabled={busy} type="button" onClick={async () => { setBusy(true); await customerApi.deleteSellerDocument(propertyId, document.id); refresh(); }}><X size={17} /></button></li>)}</ul> : <p className="seller-empty-media">No supporting documents uploaded.</p>}
      <div className="seller-editor-actions seller-editor-footer-actions">
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void saveMediaDraft()}>Save as draft</button>
        <div><button className="btn btn-secondary" type="button" disabled={busy} onClick={onBack}>Back</button><button className="btn btn-primary" type="button" disabled={busy} onClick={() => void continueToSalesMandate()}>{busy ? "Saving…" : "Continue"}</button></div>
      </div>
    </section>
  );
}
