"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {useEffect,useRef,useState,type ReactNode,type FormEvent} from "react";
import {toast} from "react-toastify";
import {listingDate,listingsRequest,type Listing,type ListingOptions} from "../../lib/listings-api";
import {useListingError,useListingRequest} from "./use-listing-request";

function Overlay({children,close,variant="modal",title}:{children:ReactNode;close:()=>void;variant?:"modal"|"drawer"|"review";title:string}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const element=dialog.current;const overflow=document.body.style.overflow;const focus=document.activeElement instanceof HTMLElement?document.activeElement:null;document.body.style.overflow="hidden";element?.showModal();return()=>{document.body.style.overflow=overflow;if(element?.open)element.close();focus?.focus();};},[]);
  return <dialog ref={dialog} className={`listing-dialog listing-dialog-${variant}`} aria-label={title} onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}}>{children}</dialog>;
}

function CloseButton({close,disabled=false,label="Close"}:{close:()=>void;disabled?:boolean;label?:string}) {return <button type="button" className="listing-dialog-close" aria-label={label} disabled={disabled} onClick={close}>×</button>;}

export function DeleteListing({listing,close,done}:{listing:Listing;close:()=>void;done:()=>void}) {
  const [pending,setPending]=useState(false);const error=useListingError();
  async function remove(){if(pending)return;setPending(true);try{await listingsRequest(`/${listing.id}`,{method:"DELETE",body:{version:listing.version}});toast.success("Listing deleted");done();}catch(failure){error(failure);setPending(false);}}
  return <Overlay title="Delete Listing?" close={()=>{if(!pending)close();}}><CloseButton close={close} disabled={pending}/><div className="listing-confirmation-content"><span className="listing-warning-symbol" aria-hidden="true">!</span><h2>Delete Listing?</h2><p>Are you sure you want to permanently delete <strong>{listing.title}</strong> ({listing.listing_code})?</p><div className="listing-warning"><strong>Warning</strong><p>This removes the property and its attached listing media permanently. This action cannot be reversed.</p></div></div><div className="listing-confirmation-actions"><button disabled={pending} onClick={close}>Cancel</button><button className="listing-danger" disabled={pending} onClick={()=>void remove()}>{pending?"Deleting...":"Delete"}</button></div></Overlay>;
}

export function UnlistListing({listing,close,done}:{listing:Listing;close:()=>void;done:()=>void}) {
  const [pending,setPending]=useState(false);const error=useListingError();
  async function unlist(){if(pending)return;setPending(true);try{await listingsRequest(`/${listing.id}/unlist`,{method:"POST",body:{version:listing.version}});toast.success("Listing unlisted");done();}catch(failure){error(failure);setPending(false);}}
  return <Overlay title="Unlist Listing?" close={()=>{if(!pending)close();}}><CloseButton close={close} disabled={pending}/><div className="listing-confirmation-content"><span className="listing-warning-symbol" aria-hidden="true">!</span><h2>Unlist Listing?</h2><p>Are you sure you want to unlist <strong>{listing.title}</strong> ({listing.listing_code})?</p><div className="listing-warning"><strong>What happens next</strong><p>The property will stop appearing in public Buy results and direct public property pages until it is reviewed and listed again.</p></div></div><div className="listing-confirmation-actions"><button disabled={pending} onClick={close}>Cancel</button><button className="listing-danger" disabled={pending} onClick={()=>void unlist()}>{pending?"Unlisting...":"Unlist"}</button></div></Overlay>;
}

export function RejectionReview({listing,close}:{listing:Listing;close:()=>void}) {
  return <Overlay title={`Review feedback for ${listing.title}`} variant="review" close={close}><CloseButton close={close}/><div className="review-property-summary">{listing.images[0]?<img src={listing.images[0].url} alt=""/>:<span aria-hidden="true">⌂</span>}<div><strong className="listing-status-pill status-rejected">Rejected</strong><h2>{listing.title}</h2><b>{listing.listing_code}</b></div></div><div className="review-alert"><h3>A few changes needed</h3><p>{listing.rejected_at?`We reviewed your listing on ${listingDate(listing.rejected_at)}. `:""}Fix the requested items and send it back for review.</p></div><div className="review-message"><h3>From Beryl Review Team</h3>{listing.rejected_at&&<time dateTime={listing.rejected_at}>{listingDate(listing.rejected_at)}</time>}<p>{listing.rejection_reason??"No review feedback is available yet. Please ask our team before making changes."}</p><Link href="/support">Not clear? Ask our team</Link></div><div className="review-actions"><Link className="listing-primary" href={`/dashboard/listings/${listing.id}/edit`}>Make changes</Link><p>After you resubmit, our team will review the listing again.</p></div></Overlay>;
}

export function ResubmitConfirmation({close,confirm,pending}:{close:()=>void;confirm:()=>void;pending:boolean}) {
  return <Overlay title="Confirm listing resubmission" close={()=>{if(!pending)close();}}><CloseButton close={close} disabled={pending}/><div className="resubmit-content"><span className="resubmit-symbol" aria-hidden="true">?</span><h2>Are you sure you have made the requested changes?</h2><p>Check you have made all the changes.<br/>We will review it again.</p><div className="resubmit-actions"><button type="button" disabled={pending} onClick={close}>No, Go back</button><button type="button" className="listing-primary" disabled={pending} onClick={confirm}>{pending?"Submitting...":"Yes, Submit"}</button></div></div></Overlay>;
}

export function DocumentDrawer({listing,close,done}:{listing:Listing;close:()=>void;done:()=>void}) {
  const {data:options}=useListingRequest<ListingOptions>("/options");const [pending,setPending]=useState(false);const [fileName,setFileName]=useState("");const error=useListingError();
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(pending)return;const form=new FormData(event.currentTarget);const file=form.get("document");if(!(file instanceof File)||!file.size||file.size>10485760){error(new Error("Choose one PDF, JPG or PNG document, up to 10 MB."));return;}const data=new FormData();data.set("data",JSON.stringify({title:form.get("title"),document_type:form.get("document_type"),description:form.get("description"),version:listing.version}));data.append("document",file);setPending(true);try{await listingsRequest(`/${listing.id}/documents`,{method:"POST",body:data});toast.success("Document uploaded");done();}catch(failure){error(failure);setPending(false);}}
  return <Overlay title="Upload Property Documents" variant="drawer" close={()=>{if(!pending)close();}}><CloseButton close={close} disabled={pending} label="Close document upload"/><h2>Upload Property Documents</h2><form className="listing-form" onSubmit={event=>void submit(event)}><fieldset disabled={pending}><label>Title <b>*</b><input name="title" required maxLength={160}/></label><label>Document type <b>*</b><select name="document_type" required defaultValue=""><option value="" disabled>Select an option</option>{options?.document_type.map(value=><option key={value}>{value}</option>)}</select></label><label>Description <b>*</b><textarea name="description" required maxLength={2000}/></label><label className="listing-document-picker">Upload Document <b>*</b><span>＋ {fileName||"Choose File"}</span><input type="file" name="document" accept="application/pdf,image/jpeg,image/png" required aria-label="Upload Document" onChange={event=>setFileName(event.target.files?.[0]?.name??"")}/></label><button className="listing-primary document-submit" type="submit">{pending?"Uploading...":"Upload Document"}</button></fieldset></form></Overlay>;
}
