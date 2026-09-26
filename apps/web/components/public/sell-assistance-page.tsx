"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import type { Customer } from "../../lib/auth-api";
import { formatNairaInput, nairaToKobo } from "../../lib/buy-query";
import { propertyFacilities } from "../../lib/property-taxonomy";
import { submitSellAssistance } from "../../lib/sell-assistance-api";
import { PublicHeader } from "../auth/public-header";
import { PublicSiteFooter } from "./public-site-footer";

const imageTypes = ["image/png", "image/jpeg", "image/webp"];
const documentTypes = ["application/pdf", "image/png", "image/jpeg"];
const initial = { contactName: "", preferredContactMethod: "", contactPhone: "", contactEmail: "", sellerType: "", location: "", propertyType: "", landArea: "", parkingSpaces: "", units: "", titleDocument: "", lienStatus: "", askingPrice: "", minimumDownPaymentPercent: "", saleAuthorized: "", likelyTransferableGiftings: "" };

export function SellAssistancePage() {
  const [values, setValues] = useState(initial); const [facilities, setFacilities] = useState<string[]>([]);
  const [images, setImages] = useState<File[]>([]); const [authorizationDocument, setAuthorizationDocument] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({}); const [status, setStatus] = useState<"idle" | "submitting" | "success" | "failure">("idle"); const [failure, setFailure] = useState("");
  const onSessionChange = useCallback((customer: Customer | null) => {
    if (!customer) return;
    setValues(current => ({ ...current, contactName: current.contactName || [customer.first_name, customer.last_name].filter(Boolean).join(" "), contactEmail: current.contactEmail || customer.email || "" }));
  }, []);
  const field = (name: keyof typeof values, value: string) => setValues(current => ({ ...current, [name]: value }));
  function numberValue(value: string, integer = false) { if (!value) return undefined; const parsed = Number(value); return Number.isFinite(parsed) && (!integer || Number.isInteger(parsed)) ? parsed : Number.NaN; }
  function validate() {
    const next: Record<string, string> = {}; const phone = /^\+?[0-9 ()-]{7,25}$/; const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (values.contactName.trim().length < 2) next.contactName = "Enter the full name of the contact person.";
    if (!['Phone', 'Email'].includes(values.preferredContactMethod)) next.preferredContactMethod = "Select a preferred contact method.";
    if (values.preferredContactMethod === "Phone" && !phone.test(values.contactPhone.trim())) next.contactPhone = "Enter a valid contact number.";
    if (values.preferredContactMethod === "Email" && !email.test(values.contactEmail.trim())) next.contactEmail = "Enter a valid contact email.";
    if (!values.location.trim()) next.location = "Enter the location of the property.";
    if (!['Residential', 'Commercial'].includes(values.propertyType)) next.propertyType = "Select a property type.";
    const price = nairaToKobo(values.askingPrice); if (!price || price === "0") next.askingPrice = "Enter a positive asking price.";
    const land = numberValue(values.landArea); if (values.landArea && (!land || land > 1e9)) next.landArea = "Enter a positive land area.";
    const parking = numberValue(values.parkingSpaces, true); if (values.parkingSpaces && (Number.isNaN(parking) || parking! < 0 || parking! > 100)) next.parkingSpaces = "Enter 0 to 100 parking spaces.";
    const units = numberValue(values.units, true); if (values.units && (Number.isNaN(units) || units! < 1 || units! > 100000)) next.units = "Enter a positive whole number.";
    const percent = numberValue(values.minimumDownPaymentPercent); if (values.minimumDownPaymentPercent && (Number.isNaN(percent) || percent! < 0 || percent! > 100)) next.minimumDownPaymentPercent = "Enter a percentage from 0 to 100.";
    if (images.length > 6 || images.some(file => !imageTypes.includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024)) next.images = "Choose up to 6 PNG, JPEG, or WEBP images no larger than 5 MB each.";
    if (values.saleAuthorized === "Yes" && !authorizationDocument) next.authorizationDocument = "Upload the authorization document for an authorized sale.";
    if (authorizationDocument && (!documentTypes.includes(authorizationDocument.type) || authorizationDocument.size < 1 || authorizationDocument.size > 10 * 1024 * 1024)) next.authorizationDocument = "Choose one PDF, PNG, or JPEG no larger than 10 MB.";
    setErrors(next); return Object.keys(next).length === 0;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (status === "submitting" || !validate()) return;
    const data = { contactName: values.contactName.trim(), preferredContactMethod: values.preferredContactMethod,
      ...(values.preferredContactMethod === "Phone" ? { contactPhone: values.contactPhone.trim() } : { contactEmail: values.contactEmail.trim().toLowerCase() }),
      ...(values.sellerType ? { sellerType: values.sellerType } : {}), location: values.location.trim(), propertyType: values.propertyType,
      ...(values.landArea ? { landArea: Number(values.landArea) } : {}), ...(values.parkingSpaces ? { parkingSpaces: Number(values.parkingSpaces) } : {}), facilities,
      ...(values.units ? { units: Number(values.units) } : {}), ...(values.titleDocument.trim() ? { titleDocument: values.titleDocument.trim() } : {}),
      ...(values.lienStatus ? { lienStatus: values.lienStatus } : {}), askingPrice: values.askingPrice.replace(/,/g, ""),
      ...(values.minimumDownPaymentPercent ? { minimumDownPaymentPercent: Number(values.minimumDownPaymentPercent) } : {}),
      ...(values.saleAuthorized ? { saleAuthorized: values.saleAuthorized === "Yes" } : {}),
      ...(values.likelyTransferableGiftings.trim() ? { likelyTransferableGiftings: values.likelyTransferableGiftings.trim() } : {}) };
    const body = new FormData(); body.set("data", JSON.stringify(data)); images.forEach(file => body.append("propertyImages", file)); if (authorizationDocument) body.set("authorizationDocument", authorizationDocument);
    setStatus("submitting"); setFailure(""); try { await submitSellAssistance(body); setStatus("success"); }
    catch (error) { setFailure(error instanceof Error ? error.message : "Your assistance request could not be submitted. Please try again."); setStatus("failure"); }
  }
  if (status === "success") return <div className="public-page sell-assistance-page"><PublicHeader sessionAware mobileMenu/><main className="sell-assistance-main"><section className="sell-assistance-success" role="status"><span aria-hidden="true">✓</span><h1>Assistance request received</h1><p>Thank you. Beryl Shelter will review the property information and contact you through your preferred method.</p><div><Link className="button button-primary" href="/">Return Home</Link><Link className="button button-outline" href="/buy">Browse Properties</Link></div></section></main><PublicSiteFooter/></div>;
  return <div className="public-page sell-assistance-page"><PublicHeader sessionAware mobileMenu onSessionChange={onSessionChange}/><main className="sell-assistance-main">
    <section className="sell-assistance-intro"><b>SELL ASSISTANCE</b><h1>Tell us about your property</h1><p>Tell us about the property you want to sell and we&apos;ll help you find potential buyers for your property.</p></section>
    <form className="sell-assistance-form" onSubmit={event => void submit(event)} noValidate><div className="sell-assistance-columns"><div>
      <Field label="1. Contact Name" helper="Enter the full name of the contact person" required error={errors.contactName}><input value={values.contactName} maxLength={120} autoComplete="name" onChange={event => field("contactName", event.target.value)}/></Field>
      <Field label="2. Preferred Contact Method" helper="We will be contacting you through this medium" required error={errors.preferredContactMethod}><select value={values.preferredContactMethod} onChange={event => field("preferredContactMethod", event.target.value)}><option value="">Select a method</option><option>Phone</option><option>Email</option></select></Field>
      {values.preferredContactMethod === "Phone" && <Field label="Contact Number" required error={errors.contactPhone}><input type="tel" inputMode="tel" autoComplete="tel" maxLength={25} value={values.contactPhone} onChange={event => field("contactPhone", event.target.value)}/></Field>}
      {values.preferredContactMethod === "Email" && <Field label="Contact Email" required error={errors.contactEmail}><input type="email" autoComplete="email" maxLength={254} value={values.contactEmail} onChange={event => field("contactEmail", event.target.value)}/></Field>}
      <Field label="3. Is this property a personal or family property or are you a developer?" helper="What type of property is this?"><select value={values.sellerType} onChange={event => field("sellerType", event.target.value)}><option value="">Select an option</option><option>Personal Property</option><option>Family Property</option><option>Developer</option></select></Field>
      <Field label="4. What Location?" helper="Enter the location of your property" required error={errors.location}><input value={values.location} maxLength={300} onChange={event => field("location", event.target.value)}/></Field>
      <Field label="5. What type of property is it?" helper="Is it a residential or commercial property?" required error={errors.propertyType}><select value={values.propertyType} onChange={event => field("propertyType", event.target.value)}><option value="">Select an option</option><option>Residential</option><option>Commercial</option></select></Field>
      <Field label="6. What is the land area of the property?" error={errors.landArea}><input type="number" inputMode="decimal" min="0" max="1000000000" value={values.landArea} onChange={event => field("landArea", event.target.value)}/></Field>
      <Field label="7. Parking Space?" error={errors.parkingSpaces}><input type="number" inputMode="numeric" min="0" max="100" value={values.parkingSpaces} onChange={event => field("parkingSpaces", event.target.value)}/></Field>
      <Field label="8. Upload picture(s) of the property" error={errors.images}><span className="sell-file-control">＋ <strong>{images.length ? `${images.length} file${images.length === 1 ? "" : "s"} selected` : "Add Photos"}</strong><input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={event => setImages([...event.target.files ?? []])}/></span></Field>
      <fieldset className="sell-facilities"><legend>9. What facilities does your property have?</legend><div>{propertyFacilities.map(facility => <label key={facility}><input type="checkbox" checked={facilities.includes(facility)} onChange={event => setFacilities(current => event.target.checked ? [...current, facility] : current.filter(value => value !== facility))}/>{facility}</label>)}</div></fieldset>
    </div><div>
      <Field label="10. How many units?" error={errors.units}><input type="number" inputMode="numeric" min="1" max="100000" value={values.units} onChange={event => field("units", event.target.value)}/></Field>
      <Field label="11. What title document does this property have?"><input value={values.titleDocument} maxLength={200} placeholder="e.g, C of O, Governor's Consent" onChange={event => field("titleDocument", event.target.value)}/></Field>
      <Field label="12. Does this property have a lien on it?"><select value={values.lienStatus} onChange={event => field("lienStatus", event.target.value)}><option value="">Select an option</option><option>Yes</option><option>No</option><option>Not Sure</option></select></Field>
      <Field label="13. How much do you want for this property?" required error={errors.askingPrice}><div className="sell-money"><span>NGN</span><input inputMode="decimal" value={values.askingPrice} onChange={event => { const formatted = formatNairaInput(event.target.value); if (formatted !== null) field("askingPrice", formatted); }}/></div></Field>
      <Field label="What is the minimum down payment" helper="Enter a percentage of the total price" error={errors.minimumDownPaymentPercent}><div className="sell-percent"><input type="number" inputMode="decimal" min="0" max="100" value={values.minimumDownPaymentPercent} placeholder="e.g 30" onChange={event => field("minimumDownPaymentPercent", event.target.value)}/><span>%</span></div></Field>
      <Field label="14. Have you authorized this sale?"><select value={values.saleAuthorized} onChange={event => { field("saleAuthorized", event.target.value); if (event.target.value !== "Yes") setAuthorizationDocument(null); }}><option value="">Select an option</option><option>Yes</option><option>No</option></select></Field>
      {values.saleAuthorized === "Yes" && <Field label="15. Upload Authorization Document" required error={errors.authorizationDocument}><span className="sell-file-control">＋ <strong>{authorizationDocument?.name || "Choose Document"}</strong><input type="file" accept="application/pdf,image/png,image/jpeg" onChange={event => setAuthorizationDocument(event.target.files?.[0] ?? null)}/></span></Field>}
      <Field label="Your likely transferable giftings?"><textarea value={values.likelyTransferableGiftings} maxLength={1000} onChange={event => field("likelyTransferableGiftings", event.target.value)}/></Field>
    </div></div>{failure && <p className="sell-assistance-error" role="alert">{failure}</p>}<button className="sell-assistance-submit" type="submit" disabled={status === "submitting"}>{status === "submitting" ? "Submitting…" : "Submit"}</button></form>
    <Link className="sell-assistance-promo" href="/referrals" aria-label="Learn about Beryl referrals"><Image src="/buy/refer-and-earn.png" alt="Refer and earn with Beryl Shelter" width={1300} height={350} unoptimized/></Link>
  </main><PublicSiteFooter/></div>;
}

function Field({ label, helper, required = false, error, children }: { label: string; helper?: string | undefined; required?: boolean; error?: string | undefined; children: ReactNode }) {
  return <label className="sell-assistance-field"><strong>{label}{required && <span> *</span>}</strong>{helper && <small>{helper}</small>}{children}{error && <em role="alert">{error}</em>}</label>;
}
