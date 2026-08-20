"use client";

import Image from "next/image";
import type { Route } from "next";
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
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  ShieldCheck,
  Toilet,
  X
} from "lucide-react";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
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
import { loginHrefFor } from "@/lib/return-to";

export type AuthPromptAction = "save" | "interest";

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
  const secondaryImages = ordered.filter((image) => image.id !== selected.id).slice(0, 4);
  return <section className="property-detail-gallery" aria-label="Property image gallery">
    <div className="property-detail-main-image"><Image src={selected.url} alt={`${title}, image ${ordered.findIndex((image) => image.id === selected.id) + 1}`} fill priority sizes="(max-width: 1023px) 100vw, 52vw" /></div>
    {secondaryImages.length ? <div className="property-detail-gallery-side" aria-label="Choose a property image">{secondaryImages.map((image, index) => <button key={image.id} type="button" aria-label={`Show image ${ordered.findIndex((item) => item.id === image.id) + 1}${image.isCover ? ", cover image" : ""}`} aria-pressed="false" onClick={() => setSelectedId(image.id)}><Image src={image.url} alt="" fill sizes="(max-width: 1023px) 96px, 24vw" />{index === secondaryImages.length - 1 ? <span className="property-detail-image-count"><Images size={16} aria-hidden="true" />See all {photoCount} photos</span> : null}</button>)}</div> : <span className="property-detail-image-count"><Images size={16} aria-hidden="true" />{photoCount} photo{photoCount === 1 ? "" : "s"}</span>}
  </section>;
}

function DetailSkeleton() {
  return <main className="property-detail-page" aria-label="Loading property details" aria-live="polite"><div className="property-detail-skeleton"><div className="property-detail-skeleton-gallery" /><div className="property-detail-skeleton-lines"><span /><span /><span /><span /></div></div></main>;
}

export function AuthPrompt({ action, onClose, trigger, returnTo }: { action: AuthPromptAction; onClose: () => void; trigger: React.RefObject<HTMLElement | null>; returnTo: string }) {
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(true, onClose, dialog, trigger);
  return <div className="property-detail-modal-backdrop"><button type="button" className="property-detail-modal-dismiss" aria-label="Dismiss sign in prompt" onClick={onClose} /><div ref={dialog} className="property-detail-modal property-detail-auth-prompt" role="dialog" aria-modal="true" aria-labelledby="auth-prompt-title"><button className="property-detail-dialog-close" type="button" aria-label="Close sign in prompt" onClick={onClose}><X size={20} /></button><ShieldCheck size={42} aria-hidden="true" /><h2 id="auth-prompt-title">Set up a free account to continue</h2><p>An account lets you {action === "save" ? "save properties and compare them later" : "register interest and hear back about this property"}.</p><div className="property-detail-auth-benefits"><span><MessageCircle size={18} />Register Interest</span><span><MapPin size={18} />Get the full address</span><span><Heart size={18} />Save what you like</span></div><div className="property-detail-modal-actions"><Link className="btn btn-primary" href={`/signup?returnTo=${encodeURIComponent(returnTo)}` as Route}>Create free account</Link><Link className="property-detail-login-link" href={loginHrefFor(returnTo) as Route}>I already have an account</Link></div></div></div>;
}

function InterestPanel({ property, authenticated, sessionLoading, onNeedAuth }: { property: MarketplacePropertyDetail; authenticated: boolean; sessionLoading: boolean; onNeedAuth: (trigger: HTMLButtonElement) => void }) {
  const successDialog = useRef<HTMLDivElement>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  const [contactMethod, setContactMethod] = useState<MarketplaceInterestContactMethod | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<MarketplaceInterestResult | null>(null);
  const submitInterest = useMutation({ mutationFn: (body: { preferredContactMethod: MarketplaceInterestContactMethod; message?: string }) => customerApi.expressMarketplaceInterest(property.id, body) });
  useDialogFocus(Boolean(success), () => setSuccess(null), successDialog, submitButton);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authenticated) {
      if (submitButton.current) onNeedAuth(submitButton.current);
      return;
    }
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

  const methodIcons = { WHATSAPP: MessageCircle, CALL: Phone, EMAIL: Mail } as const;
  return <aside className="property-detail-action-panel"><h2>Register your interest</h2><p>Choose the best way for our team to reach you.</p><form onSubmit={submit} noValidate><fieldset className="property-detail-contact-methods"><legend>What&apos;s the best way to reach you?</legend>{contactMethods.map((method) => { const Icon = methodIcons[method.value]; return <button type="button" key={method.value} role="radio" aria-checked={contactMethod === method.value} className="property-detail-contact-choice" data-selected={contactMethod === method.value} onClick={() => setContactMethod(method.value)}><Icon size={17} aria-hidden="true" /><strong>{method.label}</strong></button>; })}</fieldset><label className="property-detail-message-field" htmlFor="interest-message"><span>Anything you&apos;d like to ask? <em>• Optional</em></span><textarea id="interest-message" value={message} maxLength={1000} onChange={(event) => setMessage(event.target.value)} placeholder="e.g. Is the price negotiable? When can I view the property?" /><small>{message.length}/1000</small></label>{error ? <ApiAlert>{error}</ApiAlert> : null}<button ref={submitButton} className="btn btn-primary w-full" type="submit" disabled={submitInterest.isPending || sessionLoading}>{submitInterest.isPending ? <><Spinner label="Submitting interest" />Submitting…</> : "Send Interest"}</button></form>{success ? <div className="property-detail-modal-backdrop"><button type="button" className="property-detail-modal-dismiss" aria-label="Close interest confirmation" onClick={() => setSuccess(null)} /><div ref={successDialog} className="property-detail-modal" role="dialog" aria-modal="true" aria-labelledby="interest-success-title"><button className="property-detail-dialog-close" type="button" aria-label="Close interest confirmation" onClick={() => setSuccess(null)}><X size={20} /></button><div className="property-detail-success"><Check size={42} aria-hidden="true" /><h2 id="interest-success-title">Interest Sent</h2><p>Your interest has been recorded.</p><div className="property-detail-success-summary"><strong>{success.referenceId}</strong><span>{success.title}</span><b>{formatNaira(success.askingPrice)}</b></div><button className="btn btn-primary" type="button" onClick={() => setSuccess(null)}>Keep Browsing</button></div></div></div> : null}</aside>;
}

function DetailFacts({ property }: { property: MarketplacePropertyDetail }) {
  const facts = [
    [BedDouble, property.bedrooms, "Bedrooms"],
    [Bath, property.bathrooms, "Bathrooms"],
    [Toilet, property.toilets, "Toilets"],
    [CarFront, property.parkingSpaces, "Parking spaces"]
  ] as const;
  return <dl className="property-detail-facts">{facts.filter(([, value]) => value !== null).map(([Icon, value, label]) => <div key={label}><dt><Icon size={18} aria-hidden="true" /></dt><dd><strong>{value}</strong><span>{label}</span></dd></div>)}</dl>;
}

function PropertyDetails({ property }: { property: MarketplacePropertyDetail }) {
  const deposit = property.initialDeposit?.value !== null && property.initialDeposit?.value !== undefined
    ? property.initialDeposit.type === "PERCENTAGE" ? `${property.initialDeposit.value}%` : formatNaira(property.initialDeposit.value)
    : null;
  const rows = [["Type", humanizeMarketplaceValue(property.propertyType)], ["Category", humanizeMarketplaceValue(property.propertyCategory)], ["Condition", property.condition ? humanizeMarketplaceValue(property.condition) : null], ["Furnishing", property.furnishing ? humanizeMarketplaceValue(property.furnishing) : null], ["Initial Deposit", deposit], ["Reference ID", property.referenceId]].filter(([, value]) => value);
  return <section className="property-detail-section"><h2>Property Details</h2><dl className="property-detail-table">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>;
}

export function MarketplacePropertyDetailScreen({ propertyId }: { propertyId: string }) {
  const queryClient = useQueryClient();
  const { session, sessionLoading } = useAuth();
  const [authPrompt, setAuthPrompt] = useState<AuthPromptAction | null>(null);
  const authPromptTrigger = useRef<HTMLElement>(null);
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
  const shareProperty = async () => {
    const shareData = { title: property?.title ?? "Beryl Shelter property", url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard?.writeText(shareData.url);
    } catch {
      // Closing the native share sheet is not an application error.
    }
  };

  if (detailQuery.isLoading) return <DetailSkeleton />;
  if (detailQuery.isError || !property) return <main className="property-detail-page"><div className="property-detail-state" role="alert"><House size={42} aria-hidden="true" /><h1>Property unavailable</h1><p>This property is not available to view right now.</p><div><button className="btn btn-primary" type="button" onClick={() => detailQuery.refetch()}>Try again</button><Link className="btn btn-secondary" href="/marketplace">Back to Marketplace</Link></div></div></main>;

  const returnTo = `/marketplace/${propertyId}`;
  return <div className="property-detail-page"><MarketplaceHeader returnTo={returnTo} /><main className="property-detail-main"><div className="property-detail-topbar"><Link className="property-detail-back" href="/marketplace"><ArrowLeft size={17} aria-hidden="true" /> Back to search results</Link><div><button type="button" onClick={() => { void shareProperty(); }}><Share2 size={18} aria-hidden="true" />Share</button><button type="button" aria-label={property.saved ? "Remove saved property" : "Save property"} aria-pressed={property.saved} disabled={savePending || sessionLoading} onClick={(event) => { void toggleSave(event.currentTarget); }}><Heart size={19} fill={property.saved ? "currentColor" : "none"} />{savePending ? "Saving…" : property.saved ? "Saved" : "Save"}</button></div></div><DetailGallery images={property.images} photoCount={property.photoCount} title={property.title} /><div className="property-detail-layout"><article className="property-detail-content"><div className="property-detail-title-row"><div><div className="property-detail-price-row"><p className="property-detail-price">{formatNaira(property.askingPrice)}</p>{property.negotiable ? <span className="property-detail-negotiable">Negotiable</span> : null}</div><h1>{property.title}</h1><p className="property-detail-location"><MapPin size={18} aria-hidden="true" />{property.publicLocation}</p></div></div><DetailFacts property={property} /><section className="property-detail-section"><h2>About this property</h2><p>{property.description}</p></section>{property.verified ? <section className="property-detail-verification"><BadgeCheck size={34} aria-hidden="true" /><div><h2>Verified by Beryl</h2><p>The details and ownership documents for this property have been checked by our team.</p></div></section> : null}<PropertyDetails property={property} />{property.amenities.length ? <section className="property-detail-section"><h2>What&apos;s included</h2><ul className="property-detail-amenities">{property.amenities.map((amenity) => <li key={amenity}><Check size={17} aria-hidden="true" />{amenity}</li>)}</ul></section> : null}</article><InterestPanel property={property} authenticated={Boolean(session)} sessionLoading={sessionLoading} onNeedAuth={(trigger) => { authPromptTrigger.current = trigger; setAuthPrompt("interest"); }} /></div></main>{authPrompt ? <AuthPrompt action={authPrompt} onClose={() => setAuthPrompt(null)} trigger={authPromptTrigger} returnTo={returnTo} /> : null}</div>;
}
