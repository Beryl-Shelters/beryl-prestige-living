"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { getPhysicalMandate, physicalMandateDownloadUrl, preparePhysicalMandate, resendPhysicalMandate, submitPhysicalMandate, type Listing, type PhysicalMandate } from "../../lib/listings-api";
import { useListingError } from "./use-listing-request";

const progress=["Property details saved","Print and sign mandate","Upload signed mandate","Admin reviews documents","Property approved for sale"];

export function SalesMandateStep({listing,onBack,onSubmitted}:{listing:Listing;onBack:()=>void;onSubmitted:(listing:Listing)=>void}) {
  const reportError=useListingError();
  const [mandate,setMandate]=useState<PhysicalMandate|null>(null),[loading,setLoading]=useState(true),[resending,setResending]=useState(false),[uploading,setUploading]=useState(false),[files,setFiles]=useState<File[]>([]);
  useEffect(()=>{let active=true;void (async()=>{try{let value=await getPhysicalMandate(listing.id);if(!value)value=await preparePhysicalMandate(listing.id);if(active)setMandate(value);}catch(error){if(active)reportError(error);}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[listing.id,reportError]);
  async function resend(){setResending(true);try{await resendPhysicalMandate(listing.id);toast.success("Sales Mandate email accepted for delivery.");setMandate(await getPhysicalMandate(listing.id));}catch(error){reportError(error);}finally{setResending(false);}}
  async function upload(){if(!mandate||!files.length){reportError(new Error("Choose the complete signed Sales Mandate before uploading."));return;}setUploading(true);try{const result=await submitPhysicalMandate(listing.id,mandate.version_id,files);setMandate(result.mandate);toast.success("Signed Sales Mandate uploaded for Admin review.");onSubmitted(result.listing);}catch(error){reportError(error);}finally{setUploading(false);}}
  if(loading)return <div className="mandate-step-shell loading"><p>Preparing your Sales Mandate…</p></div>;
  if(!mandate)return <div className="mandate-step-shell"><h1>Sales Mandate unavailable</h1><p>Your property is saved. Return later to prepare the mandate.</p><button className="button button-secondary" onClick={onBack}>Back to Property Data</button></div>;
  const canUpload=mandate.status==="AWAITING_UPLOAD"||mandate.status==="REJECTED";
  return <div className="mandate-step-shell physical-mandate-step"><section className="sales-mandate-card">
    <p className="mandate-header-brand">BERYL SHELTER NIGERIA LIMITED</p><h1>Your Sales Mandate Is Ready</h1>
    {mandate.email_status==="SENT"?<p>We&apos;ve emailed your Sales Mandate to your registered email address.</p>:<p>Your Sales Mandate is ready, but we couldn&apos;t send the email. You can download it below or try resending.</p>}
    <div className="mandate-ready-meta"><p><strong>Registered email:</strong> {mandate.registered_email??listing.owner?.email??"Your registered account email"}</p><p><strong>Property reference:</strong> {mandate.property_reference??listing.listing_code}</p><p><strong>Agreement version:</strong> {mandate.agreement_version}</p></div>
    <p>Download the complete Sales Mandate, print it, fill in any missing details and sign it by hand using a pen. Then upload the complete signed document for review.</p>
    <ol className="mandate-progress">{progress.map(item=><li key={item}>{item}</li>)}</ol>
    {mandate.status==="UNDER_REVIEW"&&<div className="mandate-review-state"><h2>Signed Mandate Under Review</h2><p>Your document has been received and is awaiting Admin review.</p></div>}
    {mandate.status==="APPROVED"&&<div className="mandate-review-state"><h2>Mandate Approved</h2><p>Your signed mandate has been approved. The existing property review requirements still apply.</p></div>}
    {mandate.status==="REJECTED"&&<div className="mandate-review-state is-rejected"><h2>Mandate Needs Correction</h2><p>{mandate.rejection_reason}</p></div>}
    <div className="mandate-ready-actions"><a className="button button-primary" href={physicalMandateDownloadUrl(listing.id)}>Download Mandate</a><button className="button button-secondary" type="button" disabled={resending} onClick={()=>void resend()}>{resending?"Resending…":"Resend Email"}</button><Link className="button button-secondary" href="/dashboard/listings">View My Properties for Sale</Link></div>
    {canUpload&&<div className="signed-mandate-upload"><label>Upload Signed Mandate (PDF, JPEG or PNG)<input type="file" accept="application/pdf,image/jpeg,image/png" multiple onChange={event=>setFiles(Array.from(event.target.files??[]))}/></label>{files.length>0&&<p>{files.length} file{files.length===1?"":"s"} selected in upload order.</p>}<button className="button button-primary" type="button" disabled={uploading||!files.length} onClick={()=>void upload()}>{uploading?"Uploading…":mandate.status==="REJECTED"?"Upload Corrected Mandate":"Upload Signed Mandate"}</button></div>}
    <button className="mandate-reset-link" type="button" onClick={onBack}>Back to Property Data</button>
  </section></div>;
}
