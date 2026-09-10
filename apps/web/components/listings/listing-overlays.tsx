"use client";
import {useEffect,useRef,useState,type ReactNode,type FormEvent} from "react";
import {toast} from "react-toastify";
import {listingsRequest,type Listing,type ListingOptions} from "../../lib/listings-api";
import {useListingError,useListingRequest} from "./use-listing-request";
function Overlay({children,close,drawer=false,title}:{children:ReactNode;close:()=>void;drawer?:boolean;title:string}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow="hidden";dialog.current?.showModal();return()=>{document.body.style.overflow=previous;};},[]);
  return <dialog ref={dialog} className={drawer?"listing-dialog document-drawer":"listing-dialog delete-dialog"} aria-label={title} onCancel={close} onClick={event=>{if(event.target===event.currentTarget)close();}}>{children}</dialog>;
}
export function DeleteListing({listing,close,done}:{listing:Listing;close:()=>void;done:()=>void}) {
  const [pending,setPending]=useState(false);const error=useListingError();
  async function remove(){if(pending)return;setPending(true);try{await listingsRequest(`/${listing.id}`,{method:"DELETE",body:{version:listing.version}});toast.success("Listing deleted");done();}catch(failure){error(failure);}finally{setPending(false);}}
  return <Overlay title="Delete Listing?" close={()=>{if(!pending)close();}}><div className="delete-content"><span className="delete-symbol" aria-hidden="true">⚠</span><h2>Delete Listing?</h2><p>Are you sure you want to delete this Listing with id {listing.listing_code}?</p><div className="delete-warning"><strong>⚠ Warning</strong><p>This will remove the property from all listings permanently.<br/>And the action is irreversible.</p></div></div><div className="delete-actions"><button disabled={pending} onClick={close}>Cancel</button><button className="listing-danger" disabled={pending} onClick={()=>void remove()}>Delete</button></div></Overlay>;
}
export function DocumentDrawer({listing,close,done}:{listing:Listing;close:()=>void;done:()=>void}) {
  const {data:options}=useListingRequest<ListingOptions>("/options");
  const [pending,setPending]=useState(false);
  const error=useListingError();
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(pending)return;
    const form=new FormData(event.currentTarget);
    const file=form.get("document");
    if(!(file instanceof File)||!file.size||file.size>10485760) {
      error(new Error("Choose one document, up to 10 MB."));
      return;
    }
    const data=new FormData();
    data.set("data",JSON.stringify({title:form.get("title"),document_type:form.get("document_type"),description:form.get("description"),version:listing.version}));
    data.append("document",file);
    setPending(true);
    try {
      await listingsRequest(`/${listing.id}/documents`,{method:"POST",body:data});
      toast.success("Document uploaded");
      done();
    } catch(failure) { error(failure); }
    finally { setPending(false); }
  }
  return <Overlay title={`Upload ${listing.title} Property Document`} drawer close={()=>{if(!pending)close();}}>
    <button className="document-close" aria-label="Close document upload" disabled={pending} onClick={close}>×</button>
    <h2>Upload {listing.title} Property Document</h2>
    <form className="listing-form" onSubmit={event=>void submit(event)}>
      <fieldset disabled={pending}>
        <label>Title <b>*</b><input name="title" required maxLength={160}/></label>
        <label>Document Type <b>*</b><select name="document_type" required defaultValue=""><option value="" disabled>Select an Option</option>{options?.document_type.map(value=><option key={value}>{value}</option>)}</select></label>
        <div className="document-block">
          <label>Description <b>*</b><textarea name="description" required maxLength={2000}/></label>
          <label>Upload Document <b>*</b><input type="file" name="document" accept="application/pdf,image/jpeg,image/png" required aria-label="Upload Document"/></label>
        </div>
        <button className="listing-primary document-submit" type="submit">Upload Document</button>
      </fieldset>
    </form>
  </Overlay>;
}
