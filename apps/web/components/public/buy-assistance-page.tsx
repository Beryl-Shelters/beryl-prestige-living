"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import type { Customer } from "../../lib/auth-api";
import { submitBuyAssistance } from "../../lib/buy-assistance-api";
import { formatNairaInput, nairaToKobo } from "../../lib/buy-query";
import { nigerianStates, propertyFacilities, propertySubtypes } from "../../lib/property-taxonomy";
import { PublicHeader } from "../auth/public-header";
import { PublicSiteFooter } from "./public-site-footer";

const counts = ["1", "2", "3", "4", "5", "6", "7+"];
const timings = ["Immediately", "Within 1 Month", "Within 3 Months", "Within 6 Months", "Within 12 Months", "Flexible"];
const initial = { contactName: "", preferredContactMethod: "", contactPhone: "", contactEmail: "", propertyType: "", propertySubtype: "", bedrooms: "", bathrooms: "", locality: "", state: "", city: "", budget: "", paymentIntent: "", timing: "", likelyTransferableGiftings: "" };

export function BuyAssistancePage() {
  const [values, setValues] = useState(initial);
  const [facilities, setFacilities] = useState<string[]>([]);
  const [mandate, setMandate] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "failure">("idle");
  const [failure, setFailure] = useState("");
  const onSessionChange = useCallback((customer: Customer | null) => {
    if (!customer) return;
    setValues(current => ({ ...current, contactName: current.contactName || [customer.first_name, customer.last_name].filter(Boolean).join(" "), contactEmail: current.contactEmail || customer.email || "" }));
  }, []);
  const field = (name: keyof typeof values, value: string) => setValues(current => ({ ...current, [name]: value }));

  function validate() {
    const next: Record<string, string> = {};
    if (values.contactName.trim().length < 2) next.contactName = "Enter the full name of the contact person.";
    if (!["Phone", "Email"].includes(values.preferredContactMethod)) next.preferredContactMethod = "Select a preferred contact method.";
    if (values.preferredContactMethod === "Phone" && !/^\+?[0-9 ()-]{7,25}$/.test(values.contactPhone.trim())) next.contactPhone = "Enter a valid contact number.";
    if (values.preferredContactMethod === "Email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail.trim())) next.contactEmail = "Enter a valid contact email.";
    if (!["Residential", "Commercial"].includes(values.propertyType)) next.propertyType = "Select a property type.";
    if (values.propertyType === "Residential" && !propertySubtypes.includes(values.propertySubtype as typeof propertySubtypes[number])) next.propertySubtype = "Select a residential property subtype.";
    if (!nigerianStates.includes(values.state as typeof nigerianStates[number])) next.state = "Select a state.";
    const budget = nairaToKobo(values.budget); if (!budget || budget === "0") next.budget = "Enter a positive budget.";
    if (mandate && (mandate.type !== "application/pdf" || mandate.size < 1 || mandate.size > 10 * 1024 * 1024)) next.mandate = "Choose one PDF no larger than 10 MB.";
    setErrors(next); return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (status === "submitting" || !validate()) return;
    const data = {
      contactName: values.contactName.trim(), preferredContactMethod: values.preferredContactMethod,
      ...(values.preferredContactMethod === "Phone" ? { contactPhone: values.contactPhone.trim() } : { contactEmail: values.contactEmail.trim().toLowerCase() }),
      propertyType: values.propertyType, ...(values.propertySubtype ? { propertySubtype: values.propertySubtype } : {}),
      ...(values.bedrooms ? { bedrooms: values.bedrooms } : {}), ...(values.bathrooms ? { bathrooms: values.bathrooms } : {}),
      ...(values.locality.trim() ? { locality: values.locality.trim() } : {}), state: values.state, ...(values.city.trim() ? { city: values.city.trim() } : {}),
      facilities, budget: values.budget.replace(/,/g, ""), ...(values.paymentIntent ? { paymentIntent: values.paymentIntent } : {}),
      ...(values.timing ? { timing: values.timing } : {}), ...(values.likelyTransferableGiftings.trim() ? { likelyTransferableGiftings: values.likelyTransferableGiftings.trim() } : {}),
    };
    const body = new FormData(); body.set("data", JSON.stringify(data)); if (mandate) body.set("buyMandate", mandate);
    setStatus("submitting"); setFailure("");
    try { await submitBuyAssistance(body); setStatus("success"); }
    catch (error) { setFailure(error instanceof Error ? error.message : "Your buying assistance request could not be submitted. Please try again."); setStatus("failure"); }
  }

  if (status === "success") return <div className="public-page buy-assistance-page"><PublicHeader sessionAware mobileMenu/><main className="buy-assistance-main"><section className="buy-assistance-success" role="status"><span aria-hidden="true">✓</span><h1>Buying assistance request received</h1><p>Thank you. Beryl Shelter will review your requirements and contact you through your preferred method.</p><Link className="button button-primary" href="/buy">Browse Properties</Link></section></main><PublicSiteFooter/></div>;

  const residential = values.propertyType === "Residential";
  return <div className="public-page buy-assistance-page"><PublicHeader sessionAware mobileMenu onSessionChange={onSessionChange}/><main className="buy-assistance-main">
    <section className="buy-assistance-intro"><b>BUY ASSISTANCE</b><h1>What are your buy requirements</h1><p>Tell us about the property you want to buy and we&apos;ll help you find property(ies) that match your budget, location, and preferences!</p></section>
    <form className="buy-assistance-form" onSubmit={event => void submit(event)} noValidate><div className="buy-assistance-columns"><div>
      <Field label="1. Contact Name" helper="Enter the full name of the contact person" required error={errors.contactName}><input value={values.contactName} maxLength={120} autoComplete="name" onChange={event => field("contactName", event.target.value)}/></Field>
      <Field label="2. Preferred Contact Method" helper="We will be contacting you through this medium" required error={errors.preferredContactMethod}><select value={values.preferredContactMethod} onChange={event => field("preferredContactMethod", event.target.value)}><option value="">Select a method</option><option>Phone</option><option>Email</option></select></Field>
      {values.preferredContactMethod === "Phone" && <Field label="Contact Number" required error={errors.contactPhone}><input type="tel" inputMode="tel" autoComplete="tel" maxLength={25} value={values.contactPhone} onChange={event => field("contactPhone", event.target.value)}/></Field>}
      {values.preferredContactMethod === "Email" && <Field label="Contact Email" required error={errors.contactEmail}><input type="email" autoComplete="email" maxLength={254} value={values.contactEmail} onChange={event => field("contactEmail", event.target.value)}/></Field>}
      <Field label="3. What type of property do you want?" helper="What type of property do you intend to buy?" required error={errors.propertyType}><select value={values.propertyType} onChange={event => { const value = event.target.value; setValues(current => ({ ...current, propertyType: value, ...(value === "Commercial" ? { propertySubtype: "", bedrooms: "", bathrooms: "" } : {}) })); }}><option value="">Select an option</option><option>Residential</option><option>Commercial</option></select></Field>
      <Field label="4. Property Subtype" helper="Select the specific property subtype" required={residential} error={errors.propertySubtype}><select disabled={!residential} value={values.propertySubtype} onChange={event => field("propertySubtype", event.target.value)}><option value="">{residential ? "Select subtype" : "Not applicable"}</option>{propertySubtypes.map(option => <option key={option}>{option}</option>)}</select></Field>
      <Field label="5. How many bedrooms?"><select disabled={!residential} value={values.bedrooms} onChange={event => field("bedrooms", event.target.value)}><option value="">{residential ? "Select bedrooms" : "Not applicable"}</option>{counts.map(option => <option key={option}>{option}</option>)}</select></Field>
      <Field label="6. How many bathrooms?"><select disabled={!residential} value={values.bathrooms} onChange={event => field("bathrooms", event.target.value)}><option value="">{residential ? "Select bathrooms" : "Not applicable"}</option>{counts.map(option => <option key={option}>{option}</option>)}</select></Field>
      <Field label="7. What Locality?" helper="What locality do you want this property to be"><input value={values.locality} maxLength={120} onChange={event => field("locality", event.target.value)}/></Field>
    </div><div>
      <Field label="8. What State?" required error={errors.state}><select value={values.state} onChange={event => field("state", event.target.value)}><option value="">Select state</option>{nigerianStates.map(option => <option key={option}>{option}</option>)}</select></Field>
      <Field label="9. What City?" helper="What City do you want this property to be"><input value={values.city} maxLength={100} onChange={event => field("city", event.target.value)}/></Field>
      <fieldset className="buy-facilities"><legend>10. Required Facilities?</legend><small>What facilities will you want this property to have?</small><div>{propertyFacilities.map(facility => <label key={facility}><input type="checkbox" checked={facilities.includes(facility)} onChange={event => setFacilities(current => event.target.checked ? [...current, facility] : current.filter(value => value !== facility))}/>{facility}</label>)}</div></fieldset>
      <Field label="11. What is your budget?" helper="What is your planned budget for this property?" required error={errors.budget}><div className="buy-money"><span>NGN</span><input inputMode="decimal" value={values.budget} onChange={event => { const formatted = formatNairaInput(event.target.value); if (formatted !== null) field("budget", formatted); }}/></div></Field>
      <Field label="12. How are you paying" helper="Is it an outright cash purchase or will a mortgage be obtained?"><select value={values.paymentIntent} onChange={event => field("paymentIntent", event.target.value)}><option value="">Select an option</option><option>Outright Cash Purchase</option><option>Mortgage</option></select></Field>
      <Field label="13. How soon do you need this property?" helper="How urgent do you need this property?"><select value={values.timing} onChange={event => field("timing", event.target.value)}><option value="">Select timing</option>{timings.map(option => <option key={option}>{option}</option>)}</select></Field>
      <Field label="14. Buy Mandate" helper="Upload Buy Mandate Document" error={errors.mandate}><span className="buy-file-control">↥ <strong>{mandate?.name || "Choose PDF"}</strong><input type="file" accept="application/pdf" onChange={event => setMandate(event.target.files?.[0] ?? null)}/></span></Field>
      <Field label="15. Your likely transferable giftings?" helper="What are your likely transferable giftings?"><textarea value={values.likelyTransferableGiftings} maxLength={1000} onChange={event => field("likelyTransferableGiftings", event.target.value)}/></Field>
    </div></div>{failure && <p className="buy-assistance-error" role="alert">{failure}</p>}<button className="buy-assistance-submit" type="submit" disabled={status === "submitting"}>{status === "submitting" ? "Submitting…" : "Submit"}</button></form>
    <Link className="buy-assistance-promo" href="/referrals" aria-label="Learn about Beryl referrals"><Image src="/buy/refer-and-earn.png" alt="Refer and earn with Beryl Shelter" width={1300} height={350} unoptimized/></Link>
  </main><PublicSiteFooter/></div>;
}

function Field({ label, helper, required = false, error, children }: { label: string; helper?: string | undefined; required?: boolean | undefined; error?: string | undefined; children: ReactNode }) {
  return <label className="buy-assistance-field"><strong>{label}{required && <span> *</span>}</strong>{helper && <small>{helper}</small>}{children}{error && <em role="alert">{error}</em>}</label>;
}
