"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiAlert, Spinner } from "@/components/ui/feedback";
import { customerApi } from "@/lib/api/client";
import type { SellerDraft } from "@/lib/contracts";
import { continueSellerDraftToSalesMandate } from "@/lib/seller-draft-transition";

type EditorStep = "PROPERTY_INFORMATION" | "PHOTOS_DOCUMENTS" | "SALES_MANDATE";

const empty: Partial<SellerDraft> = {
  propertyCategory: "RESIDENTIAL",
  negotiable: false,
  amenities: [],
  currentStep: "PROPERTY_INFORMATION"
};
const amenityOptions = ["Security", "Swimming pool", "Generator", "Gym", "Balcony", "CCTV"];

export function SellerDraftEditor({
  propertyId: initialId,
  initialStep
}: {
  propertyId?: string;
  initialStep?: EditorStep;
}) {
  const router = useRouter();
  const [id, setId] = useState(initialId);
  const [step, setStep] = useState<EditorStep>(initialStep ?? "PROPERTY_INFORMATION");
  const [draft, setDraft] = useState<Partial<SellerDraft>>(empty);
  const [custom, setCustom] = useState("");
  const [status, setStatus] = useState("");
  const hydrated = useRef(false);
  const savedSnapshot = useRef("");
  const saveSequence = useRef(0);

  const restored = useQuery({
    queryKey: ["seller-draft", id],
    queryFn: () => customerApi.sellerDraft(id!),
    enabled: Boolean(id)
  });

  useEffect(() => {
    const property = restored.data?.data.property;
    if (!property) return;

    setDraft(property);
    setStep(initialStep ?? normalizeStep(property.currentStep));
    savedSnapshot.current = JSON.stringify(property);
    hydrated.current = true;
  }, [initialStep, restored.data]);

  const persist = useMutation({
    mutationFn: async (next: Partial<SellerDraft>) => {
      if (id) return customerApi.saveSellerDraft(id, next);

      const created = await customerApi.createSellerDraft(next);
      const createdId = created.data.property.id;
      setId(createdId);
      router.replace(`/seller/listings/${createdId}/edit` as Route);
      return created;
    }
  });

  const save = async (next: Partial<SellerDraft> = draft) => {
    setStatus("Saving…");
    try {
      await persist.mutateAsync(next);
      savedSnapshot.current = JSON.stringify(next);
      setStatus("Saved");
      return true;
    } catch {
      setStatus("Save failed. Please try again.");
      return false;
    }
  };

  const change = (key: keyof SellerDraft, value: unknown) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    if (!id || !hydrated.current || step !== "PROPERTY_INFORMATION" || persist.isPending) return;
    const snapshot = JSON.stringify(draft);
    if (snapshot === savedSnapshot.current) return;

    const timer = window.setTimeout(async () => {
      const sequence = ++saveSequence.current;
      setStatus("Saving…");
      try {
        await customerApi.saveSellerDraft(id, draft);
        if (sequence === saveSequence.current) {
          savedSnapshot.current = snapshot;
          setStatus("Saved");
        }
      } catch {
        if (sequence === saveSequence.current) setStatus("Couldn’t save changes");
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [draft, id, persist.isPending, step]);

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

    const next = { ...draft, currentStep: "PHOTOS_DOCUMENTS" as const };
    setDraft(next);
    if (await save(next)) setStep("PHOTOS_DOCUMENTS");
  };

  const addAmenity = () => {
    const value = custom.trim();
    if (!value || draft.amenities?.some((amenity) => amenity.toLowerCase() === value.toLowerCase())) return;
    change("amenities", [...(draft.amenities ?? []), value]);
    setCustom("");
  };

  if (restored.isLoading) {
    return <main className="seller-listings-page"><Spinner label="Loading draft" /></main>;
  }
  if (restored.isError) {
    return <main className="seller-listings-page"><ApiAlert>We could not restore this draft.</ApiAlert></main>;
  }

  const stepNumber = step === "PROPERTY_INFORMATION" ? 1 : step === "PHOTOS_DOCUMENTS" ? 2 : 3;
  return (
    <main className="seller-listings-page seller-editor">
      <header>
        <p className="seller-kicker">Seller marketplace</p>
        <h1>Create a listing</h1>
        <p>Step {stepNumber} of 4</p>
        <div className="seller-stepper">
          <span className={step === "PROPERTY_INFORMATION" ? "active" : "done"}>1 Property information</span>
          <span className={step === "PHOTOS_DOCUMENTS" ? "active" : step === "SALES_MANDATE" ? "done" : ""}>2 Photos &amp; documents</span>
          <span className={step === "SALES_MANDATE" ? "active" : ""}>3 Sales mandate</span>
          <span>4 Review</span>
        </div>
      </header>
      {status ? <p role="status">{status}</p> : null}
      {step === "PROPERTY_INFORMATION" ? (
        <PropertyInformationStep
          draft={draft}
          customAmenity={custom}
          pending={persist.isPending}
          onChange={change}
          onCustomAmenityChange={setCustom}
          onAddAmenity={addAmenity}
          onSave={() => void save()}
          onContinue={() => void continueStepOne()}
        />
      ) : step === "PHOTOS_DOCUMENTS" ? (
        <MediaStep propertyId={id!} draft={draft} onBack={() => setStep("PROPERTY_INFORMATION")} />
      ) : (
        <section className="seller-editor-card" aria-labelledby="sales-mandate-title">
          <h2 id="sales-mandate-title">Sales Mandate</h2>
          <p>This step will be available in the next Marketplace implementation slice.</p>
        </section>
      )}
    </main>
  );
}

function normalizeStep(step: SellerDraft["currentStep"]): EditorStep {
  return step === "PHOTOS_DOCUMENTS" || step === "SALES_MANDATE" ? step : "PROPERTY_INFORMATION";
}

function PropertyInformationStep({
  draft,
  customAmenity,
  pending,
  onChange,
  onCustomAmenityChange,
  onAddAmenity,
  onSave,
  onContinue
}: {
  draft: Partial<SellerDraft>;
  customAmenity: string;
  pending: boolean;
  onChange: (key: keyof SellerDraft, value: unknown) => void;
  onCustomAmenityChange: (value: string) => void;
  onAddAmenity: () => void;
  onSave: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="seller-editor-card">
      <h2>Property information</h2>
      <label>Title<input value={draft.title ?? ""} onChange={(event) => onChange("title", event.target.value)} /></label>
      <label>Description<textarea value={draft.description ?? ""} onChange={(event) => onChange("description", event.target.value)} /></label>
      <label>Category<select value={draft.propertyCategory ?? "RESIDENTIAL"} onChange={(event) => onChange("propertyCategory", event.target.value)}><option value="RESIDENTIAL">Residential</option><option value="COMMERCIAL">Commercial</option></select></label>
      <label>Property type<input value={draft.propertyType ?? ""} onChange={(event) => onChange("propertyType", event.target.value)} /></label>
      <label>Ownership<select value={draft.ownershipType ?? ""} onChange={(event) => onChange("ownershipType", event.target.value)}><option value="">Select ownership</option><option value="PERSONAL">Personal</option><option value="THIRD_PARTY">Third party</option></select></label>
      <label>Public location<input value={draft.publicLocation ?? ""} onChange={(event) => onChange("publicLocation", event.target.value)} /></label>
      <label>Full address<input value={draft.fullAddress ?? ""} onChange={(event) => onChange("fullAddress", event.target.value)} /></label>
      <label>Asking price (NGN)<input type="number" min="0" value={draft.askingPrice ?? ""} onChange={(event) => onChange("askingPrice", event.target.value === "" ? undefined : Number(event.target.value))} /></label>
      <label><input type="checkbox" checked={Boolean(draft.negotiable)} onChange={(event) => onChange("negotiable", event.target.checked)} /> Price is negotiable</label>
      {draft.propertyCategory === "RESIDENTIAL" ? (
        <>
          <label>Bedrooms<input type="number" min="0" value={draft.bedrooms ?? ""} onChange={(event) => onChange("bedrooms", event.target.value ? Number(event.target.value) : null)} /></label>
          <label>Bathrooms<input type="number" min="0" value={draft.bathrooms ?? ""} onChange={(event) => onChange("bathrooms", event.target.value ? Number(event.target.value) : null)} /></label>
        </>
      ) : (
        <>
          <label>Number of floors<input type="number" min="0" value={draft.numberOfFloors ?? ""} onChange={(event) => onChange("numberOfFloors", event.target.value ? Number(event.target.value) : null)} /></label>
          <label>Parking capacity<input type="number" min="0" value={draft.parkingCapacity ?? ""} onChange={(event) => onChange("parkingCapacity", event.target.value ? Number(event.target.value) : null)} /></label>
        </>
      )}
      <label>Initial deposit<select value={draft.initialDepositType ?? ""} onChange={(event) => onChange("initialDepositType", event.target.value || null)}><option value="">None</option><option value="AMOUNT">Amount</option><option value="PERCENTAGE">Percentage</option></select></label>
      {draft.initialDepositType ? <label>Deposit value<input type="number" min="0" max={draft.initialDepositType === "PERCENTAGE" ? 100 : undefined} value={draft.initialDepositValue ?? ""} onChange={(event) => onChange("initialDepositValue", event.target.value ? Number(event.target.value) : null)} /></label> : null}
      <div>
        <strong>Amenities</strong>
        {amenityOptions.map((amenity) => <button type="button" key={amenity} onClick={() => onChange("amenities", draft.amenities?.includes(amenity) ? draft.amenities.filter((item) => item !== amenity) : [...(draft.amenities ?? []), amenity])}>{amenity}</button>)}
        <input value={customAmenity} onChange={(event) => onCustomAmenityChange(event.target.value)} placeholder="Add an amenity" />
        <button type="button" onClick={onAddAmenity}>Add</button>
        <p>{draft.amenities?.join(", ")}</p>
      </div>
      <div>
        <button className="btn btn-secondary" type="button" disabled={pending} onClick={onSave}>Save as draft</button>
        <button className="btn btn-primary" type="button" disabled={pending} onClick={onContinue}>Continue</button>
      </div>
    </section>
  );
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

  const images = [...(draft.images ?? [])].sort((first, second) => first.order - second.order);
  return (
    <section className="seller-editor-card">
      <h2>Photos &amp; documents</h2>
      {error ? <ApiAlert>{error}</ApiAlert> : null}
      <label>Upload property photos<input disabled={busy || images.length >= 10} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={upload} /></label>
      <p>{images.length}/10 photos · JPEG, PNG or WEBP · 5MB each</p>
      {images.length ? (
        <div className="seller-media-grid">
          {images.map((image, index) => (
            <article key={image.id}>
              <Image src={image.url} alt={`Property photo ${index + 1}`} width={640} height={420} />
              <strong>{image.isCover ? "Cover image" : `Photo ${index + 1}`}</strong>
              <div>
                <button disabled={busy || index === 0} type="button" onClick={async () => { setBusy(true); await customerApi.reorderSellerImages(propertyId, [...images.slice(0, index - 1), image, images[index - 1], ...images.slice(index + 1)].map((item) => item.id)); refresh(); }}>Move left</button>
                {!image.isCover ? <button disabled={busy} type="button" onClick={async () => { setBusy(true); await customerApi.setSellerCover(propertyId, image.id); refresh(); }}>Set as cover</button> : null}
                <button disabled={busy} type="button" onClick={async () => { setBusy(true); await customerApi.deleteSellerImage(propertyId, image.id); refresh(); }}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      ) : <p>No photos yet. Upload a photo to begin.</p>}
      <label>Document type<select value={type} onChange={(event) => setType(event.target.value)}><option value="DEED">Deed</option><option value="SURVEY_PLAN">Survey plan</option><option value="OWNERSHIP_PAPERS">Ownership papers</option><option value="CERTIFICATE_OF_OCCUPANCY">Certificate of occupancy</option><option value="OTHER">Other</option></select></label>
      <label>Upload private PDF (10MB max)<input disabled={busy} type="file" accept="application/pdf" onChange={async (event) => {
        const file = event.target.files?.[0];
        if (!file || file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) { setError("Use a PDF up to 10MB."); return; }
        setBusy(true);
        const body = new FormData();
        body.append("document", file);
        body.append("documentType", type);
        body.append("displayName", file.name);
        try { await customerApi.uploadSellerDocument(propertyId, body); refresh(); } catch { setError("Document upload failed. Please try again."); setBusy(false); }
      }} /></label>
      {draft.documents?.length ? <ul>{draft.documents.map((document) => <li key={document.id}>{document.displayName} ({document.documentType}) <button disabled={busy} type="button" onClick={async () => { setBusy(true); await customerApi.deleteSellerDocument(propertyId, document.id); refresh(); }}>Delete</button></li>)}</ul> : <p>No supporting documents uploaded. Documents are optional.</p>}
      <div>
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={onBack}>Back</button>
        <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void continueToSalesMandate()}>{busy ? "Saving…" : "Continue"}</button>
      </div>
    </section>
  );
}
