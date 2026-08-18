"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Bath,
  BedDouble,
  CarFront,
  Check,
  Heart,
  House,
  Images,
  MapPin,
  MessageSquareText,
  ShieldCheck,
  Toilet,
  X
} from "lucide-react";
import { BerylShelterLogo } from "@/components/brand/beryl-shelter-logo";
import { ApiAlert, Spinner } from "@/components/ui/feedback";
import { useAuth } from "@/context/auth-provider";
import { customerApi, marketplaceApi } from "@/lib/api/client";
import { apiErrorOf } from "@/lib/api/errors";
import type {
  ApiSuccess,
  MarketplaceGalleryImage,
  MarketplaceInterestContactMethod,
  MarketplaceInterestResult,
  MarketplacePropertyDetail,
  MarketplacePropertyDetailResult
} from "@/lib/contracts";
import { formatNaira, humanizeMarketplaceValue } from "@/lib/marketplace";

type AuthPromptAction = "save" | "interest";

const contactMethods: { value: MarketplaceInterestContactMethod; label: string; description: string }[] = [
  { value: "WHATSAPP", label: "WhatsApp", description: "Use your WhatsApp number" },
  { value: "CALL", label: "Call", description: "Use your phone number" },
  { value: "EMAIL", label: "Email", description: "Use your email address" }
];

const interestError = (code?: string) => {
  switch (code) {
    case "CONTACT_METHOD_UNAVAILABLE": return "That contact method is not available on your account. Choose another method.";
    case "PROPERTY_NOT_AVAILABLE": return "This property is no longer available.";
    case "RATE_LIMIT_EXCEEDED": return "You recently submitted interest in this property. Please wait before trying again.";
    case "INVALID_CONTACT_METHOD": return "Choose how you would like to be contacted.";
    case "INVALID_INTEREST_MESSAGE": return "Your message must be 1,000 characters or fewer.";
    case "INTEREST_SUBMISSION_FAILED": return "We could not submit your interest right now. Please try again.";
    default: return "We could not submit your interest right now. Please try again.";
  }
};

function useDialogFocus(open: boolean, onClose: () => void, dialog: React.RefObject<HTMLElement | null>, trigger: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const root = dialog.current;
    const triggerElement = trigger.current;
    const controls = () => Array.from(root?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), [href], [role="radio"]') ?? []);
    controls()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = controls();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      (triggerElement ?? previouslyFocused)?.focus();
    };
  }, [dialog, onClose, open, trigger]);
}

function DetailGallery({ images, photoCount, title }: { images: MarketplaceGalleryImage[]; photoCount: number; title: string }) {
  const ordered = useMemo(() => [...images].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)), [images]);
  const [selectedId, setSelectedId] = useState<string | null>(() => ordered.find((image) => image.isCover)?.id ?? ordered[0]?.id ?? null);
  useEffect(() => { setSelectedId(ordered.find((image) => image.isCover)?.id ?? ordered[0]?.id ?? null); }, [ordered]);
  const selected = ordered.find((image) => image.id === selectedId) ?? ordered[0];

  if (!selected) return <div className="property-detail-gallery property-detail-gallery-empty"><House size={46} aria-hidden="true" /><span>Property images are not available</span></div>;
  return <section className="property-detail-gallery" aria-label="Property image gallery">
    <div className="property-detail-main-image"><Image src={selected.url} alt={`${title}, image ${ordered.findIndex((image) => image.id === selected.id) + 1}`} fill priority sizes="(max-width: 1023px) 100vw, 65vw" /><span className="property-detail-image-count"><Images size={16} aria-hidden="true" />{photoCount} photos</span></div>
    {ordered.length > 1 ? <div className="property-detail-thumbnails" aria-label="Choose a property image">{ordered.map((image, index) => <button key={image.id} type="button" aria-label={`Show image ${index + 1}${image.isCover ? ", cover image" : ""}`} aria-pressed={selected.id === image.id} onClick={() => setSelectedId(image.id)}><Image src={image.url} alt="" fill sizes="96px" /></button>)}</div> : null}
  </section>;
}

function DetailSkeleton() {
  return <main className="property-detail-page" aria-label="Loading property details" aria-live="polite"><div className="property-detail-skeleton"><div className="property-detail-skeleton-gallery" /><div className="property-detail-skeleton-lines"><span /><span /><span /><span /></div></div></main>;
}

function AuthPrompt({ action, onClose, trigger }: { action: AuthPromptAction; onClose: () => void; trigger: React.RefObject<HTMLElement | null> }) {
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(true, onClose, dialog, trigger);
  const title = action === "save" ? "Save this property" : "Register your interest";
  return <div className="property-detail-modal-backdrop"><button type="button" className="property-detail-modal-dismiss" aria-label="Close sign in prompt" onClick={onClose} /><div ref={dialog} className="property-detail-modal" role="dialog" aria-modal="true" aria-labelledby="auth-prompt-title"><button className="property-detail-dialog-close" type="button" aria-label="Close sign in prompt" onClick={onClose}><X size={20} /></button><ShieldCheck size={38} aria-hidden="true" /><h2 id="auth-prompt-title">{title}</h2><p>Create an account or log in to save properties and contact our team about a listing.</p><div className="property-detail-modal-actions"><Link className="btn btn-primary" href="/login">Log in</Link><Link className="btn btn-secondary" href="/signup">Create account</Link></div></div></div>;
}

function InterestDialog({ property, onClose, trigger }: { property: MarketplacePropertyDetail; onClose: () => void; trigger: React.RefObject<HTMLElement | null> }) {
  const dialog = useRef<HTMLDivElement>(null);
  const [contactMethod, setContactMethod] = useState<MarketplaceInterestContactMethod | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<MarketplaceInterestResult | null>(null);
  const submitInterest = useMutation({ mutationFn: (body: { preferredContactMethod: MarketplaceInterestContactMethod; message?: string }) => customerApi.expressMarketplaceInterest(property.id, body) });
  useDialogFocus(true, onClose, dialog, trigger);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!contactMethod) {
      setError("Choose how you would like to be contacted.");
      return;
    }
    if (trimmedMessage.length > 1000) {
      setError("Your message must be 1,000 characters or fewer.");
      return;
    }
    setError("");
    try {
      const result = await submitInterest.mutateAsync({ preferredContactMethod: contactMethod, ...(trimmedMessage ? { message: trimmedMessage } : {}) });
      setSuccess(result.data);
    } catch (caught) {
      setError(interestError(apiErrorOf(caught).code));
    }
  };

  return <div className="property-detail-modal-backdrop"><button type="button" className="property-detail-modal-dismiss" aria-label="Close interest form" onClick={onClose} /><div ref={dialog} className="property-detail-modal property-detail-interest-modal" role="dialog" aria-modal="true" aria-labelledby="interest-title">{success ? <div className="property-detail-success"><Check size={42} aria-hidden="true" /><h2 id="interest-title">Interest submitted</h2><p>Your interest in {success.title} has been recorded.</p><button className="btn btn-primary" type="button" onClick={onClose}>Keep browsing</button></div> : <><button className="property-detail-dialog-close" type="button" aria-label="Close interest form" onClick={onClose}><X size={20} /></button><MessageSquareText size={37} aria-hidden="true" /><h2 id="interest-title">I am interested in this property</h2><p>Choose how you would like to be contacted about {property.title}.</p><form onSubmit={submit} noValidate><fieldset className="property-detail-contact-methods"><legend>Preferred contact method</legend>{contactMethods.map((method) => <button type="button" key={method.value} role="radio" aria-checked={contactMethod === method.value} className="property-detail-contact-choice" data-selected={contactMethod === method.value} onClick={() => setContactMethod(method.value)}><strong>{method.label}</strong><span>{method.description}</span></button>)}</fieldset><label className="property-detail-message-field" htmlFor="interest-message"><span>Message <em>(optional)</em></span><textarea id="interest-message" value={message} maxLength={1000} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us anything useful about your interest" /><small>{message.length}/1000</small></label>{error ? <ApiAlert>{error}</ApiAlert> : null}<button className="btn btn-primary w-full" type="submit" disabled={submitInterest.isPending}>{submitInterest.isPending ? <><Spinner label="Submitting interest" />Submitting…</> : "Submit interest"}</button></form></>}</div></div>;
}

function DetailFacts({ property }: { property: MarketplacePropertyDetail }) {
  const facts = [
    [BedDouble, property.bedrooms, "Bedrooms"],
    [Bath, property.bathrooms, "Bathrooms"],
    [Toilet, property.toilets, "Toilets"],
    [CarFront, property.parkingSpaces, "Parking spaces"]
  ] as const;
  const extras = [
    ["Condition", property.condition ? humanizeMarketplaceValue(property.condition) : null],
    ["Furnishing", property.furnishing ? humanizeMarketplaceValue(property.furnishing) : null],
    ["Floors", property.numberOfFloors],
    ["Parking capacity", property.parkingCapacity],
    ["Initial deposit", property.initialDeposit?.value !== null && property.initialDeposit?.value !== undefined ? property.initialDeposit.type === "PERCENTAGE" ? `${property.initialDeposit.value}%` : formatNaira(property.initialDeposit.value) : null]
  ].filter(([, value]) => value !== null && value !== undefined);
  return <><dl className="property-detail-facts">{facts.filter(([, value]) => value !== null).map(([Icon, value, label]) => <div key={label}><dt><Icon size={22} aria-hidden="true" /></dt><dd><strong>{value}</strong><span>{label}</span></dd></div>)}</dl>{extras.length ? <dl className="property-detail-extra-facts">{extras.map(([label, value]) => <div key={label as string}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : null}</>;
}

export function MarketplacePropertyDetailScreen({ propertyId }: { propertyId: string }) {
  const queryClient = useQueryClient();
  const { session, sessionLoading } = useAuth();
  const [authPrompt, setAuthPrompt] = useState<AuthPromptAction | null>(null);
  const [interestOpen, setInterestOpen] = useState(false);
  const authPromptTrigger = useRef<HTMLElement>(null);
  const interestTrigger = useRef<HTMLButtonElement>(null);
  const detailQuery = useQuery({ queryKey: ["marketplace-property", propertyId], queryFn: () => marketplaceApi.detail(propertyId) });
  const saveMutation = useMutation({ mutationFn: () => customerApi.saveProperty(propertyId) });
  const unsaveMutation = useMutation({ mutationFn: () => customerApi.unsaveProperty(propertyId) });
  const property = detailQuery.data?.data.property;
  const savePending = saveMutation.isPending || unsaveMutation.isPending;

  const updateSaved = (saved: boolean) => queryClient.setQueryData<ApiSuccess<MarketplacePropertyDetailResult>>(["marketplace-property", propertyId], (current) => current ? { ...current, data: { property: { ...current.data.property, saved } } } : current);
  const toggleSave = async (trigger: HTMLButtonElement) => {
    if (sessionLoading) return;
    if (!session) {
      authPromptTrigger.current = trigger;
      setAuthPrompt("save");
      return;
    }
    try {
      if (property?.saved) {
        await unsaveMutation.mutateAsync();
        updateSaved(false);
      } else {
        await saveMutation.mutateAsync();
        updateSaved(true);
      }
    } catch {
      await detailQuery.refetch();
    }
  };
  const openInterest = () => {
    if (sessionLoading) return;
    if (!session) {
      authPromptTrigger.current = interestTrigger.current;
      setAuthPrompt("interest");
      return;
    }
    setInterestOpen(true);
  };

  if (detailQuery.isLoading) return <DetailSkeleton />;
  if (detailQuery.isError || !property) return <main className="property-detail-page"><div className="property-detail-state" role="alert"><House size={42} aria-hidden="true" /><h1>Property unavailable</h1><p>This property is not available to view right now.</p><div><button className="btn btn-primary" type="button" onClick={() => detailQuery.refetch()}>Try again</button><Link className="btn btn-secondary" href="/marketplace">Back to Marketplace</Link></div></div></main>;

  return <div className="property-detail-page"><header className="marketplace-header"><Link href="/" aria-label="Beryl Shelter home"><BerylShelterLogo /></Link><nav aria-label="Primary navigation"><Link href="/marketplace">Marketplace</Link><Link href="/signup?intent=LIST_PROPERTY">List a property</Link></nav><div className="marketplace-header-actions"><Link href="/login">Log in</Link><Link className="btn btn-primary" href="/signup">Get started</Link></div></header><main className="property-detail-main"><Link className="property-detail-back" href="/marketplace"><ArrowLeft size={17} aria-hidden="true" /> Back to Marketplace</Link><DetailGallery images={property.images} photoCount={property.photoCount} title={property.title} /><div className="property-detail-layout"><article className="property-detail-content"><div className="property-detail-title-row"><div><div className="property-detail-badges"><span>{humanizeMarketplaceValue(property.propertyType)}</span><span>{humanizeMarketplaceValue(property.propertyCategory)}</span>{property.verified ? <span className="property-detail-verified"><BadgeCheck size={15} aria-hidden="true" />Verified</span> : null}</div><h1>{property.title}</h1><p className="property-detail-location"><MapPin size={18} aria-hidden="true" />{property.publicLocation}</p></div><button type="button" className="property-detail-save-mobile" aria-label={property.saved ? "Remove saved property" : "Save property"} aria-pressed={property.saved} disabled={savePending || sessionLoading} onClick={(event) => { void toggleSave(event.currentTarget); }}><Heart size={21} fill={property.saved ? "currentColor" : "none"} />{savePending ? <Spinner label="Saving property" /> : null}</button></div><DetailFacts property={property} /><section className="property-detail-section"><h2>About this property</h2><p>{property.description}</p></section>{property.amenities.length ? <section className="property-detail-section"><h2>Features & amenities</h2><ul className="property-detail-amenities">{property.amenities.map((amenity) => <li key={amenity}><Check size={17} aria-hidden="true" />{amenity}</li>)}</ul></section> : null}</article><aside className="property-detail-action-panel"><div><p className="property-detail-price">{formatNaira(property.askingPrice)}</p>{property.negotiable ? <span className="property-detail-negotiable">Negotiable</span> : null}</div><button type="button" className="btn btn-secondary property-detail-save-button" aria-pressed={property.saved} disabled={savePending || sessionLoading} onClick={(event) => { void toggleSave(event.currentTarget); }}><Heart size={18} fill={property.saved ? "currentColor" : "none"} />{savePending ? "Saving…" : property.saved ? "Saved" : "Save property"}</button><button ref={interestTrigger} type="button" className="btn btn-primary property-detail-interest-button" disabled={sessionLoading} onClick={openInterest}>I am interested in this property</button><p>Listing reference: {property.referenceId}</p></aside></div></main>{authPrompt ? <AuthPrompt action={authPrompt} onClose={() => setAuthPrompt(null)} trigger={authPromptTrigger} /> : null}{interestOpen ? <InterestDialog property={property} onClose={() => setInterestOpen(false)} trigger={interestTrigger} /> : null}</div>;
}
