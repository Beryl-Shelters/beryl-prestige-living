"use client";
/* Company logos are validated HTTPS Cloudinary URLs; render without an image proxy. */
/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useCallback,useEffect,useRef,useState } from "react";
import { toast } from "react-toastify";
import { AuthApiError } from "../../lib/auth-api";
import { fetchSettingsBusiness,saveSettingsBusiness,type SettingsBusiness } from "../../lib/settings-api";
import { BrandLoader } from "../auth/brand-loader";
import { showAuthError } from "../auth/toast-provider";

export function SettingsBusinessScreen(){
  const router=useRouter(),[saved,setSaved]=useState<SettingsBusiness|null>(null),[draft,setDraft]=useState<SettingsBusiness|null>(null),[file,setFile]=useState<File>(),[fileKey,setFileKey]=useState(0),[saving,setSaving]=useState(false),[failed,setFailed]=useState(false),[revision,setRevision]=useState(0),form=useRef<HTMLFormElement>(null);
  const failure=useCallback((error:unknown)=>{if(error instanceof AuthApiError&&["SESSION_EXPIRED","AUTH_REQUIRED"].includes(error.code))router.replace("/login");else showAuthError(error,"settings-business-error");},[router]);
  useEffect(()=>{const controller=new AbortController();fetchSettingsBusiness(controller.signal).then(value=>{if(!controller.signal.aborted){setSaved(value);setDraft(value);setFailed(false);}}).catch(error=>{if(!controller.signal.aborted){setFailed(true);failure(error);}});return()=>controller.abort();},[failure,revision]);
  if(!draft)return failed?<div className="settings-business-status"><button className="button button-primary" onClick={()=>{setFailed(false);setRevision(value=>value+1);}}>Try again</button></div>:<BrandLoader/>;
  const set=(key:keyof SettingsBusiness,value:string)=>setDraft(current=>current?{...current,[key]:value}:current),initials=(draft.companyName.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join("")||"CO").toUpperCase();
  const logo=(large=false)=><div className={`settings-avatar company${large?" large":""}${draft.companyLogoUrl?" has-image":""}`}>{draft.companyLogoUrl?<img src={draft.companyLogoUrl} alt="Company logo"/>:initials}</div>;
  async function save(event:React.FormEvent){event.preventDefault();if(!form.current?.reportValidity()||saving)return;setSaving(true);try{const value=await saveSettingsBusiness(draft!,file);setSaved(value);setDraft(value);setFile(undefined);setFileKey(value=>value+1);toast.success("Business profile updated successfully");}catch(error){failure(error);}finally{setSaving(false);}}
  function cancel(){if(saved){setDraft(saved);setFile(undefined);setFileKey(value=>value+1);}}
  return <form ref={form} onSubmit={save} className="dashboard-card settings-card" aria-busy={saving}>
    <header className="settings-identity">{logo()}<div className="settings-company-title"><strong>{draft.companyName||"Company"}</strong><span>{draft.companyEmail}</span></div></header>
    <BusinessSection title="Company Information" copy="Update your company information to keep your business details accurate and up to date."><div className="settings-fields two">
      <BusinessField label="Company ID" value={draft.companyId} readOnly/><BusinessField label="Company Name" value={draft.companyName} required onChange={value=>set("companyName",value)}/><BusinessField label="Company Email Address" value={draft.companyEmail} required type="email" onChange={value=>set("companyEmail",value)}/><BusinessField label="Company Phone Number" value={draft.companyPhoneNumber} required pattern="\+?[0-9]{5,15}" onChange={value=>set("companyPhoneNumber",value)}/><label className="wide">About Company<textarea maxLength={1000} value={draft.aboutCompany} onChange={event=>set("aboutCompany",event.target.value)} placeholder="Enter a brief bio"/></label>
    </div></BusinessSection>
    <BusinessSection title="Company Logo" copy="Update your company logo. This will be displayed publicly."><div className="settings-picture">{logo(true)}<label className="settings-upload">Click to upload or drag and drop<input key={fileKey} aria-label="Company Logo Upload" type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={event=>setFile(event.target.files?.[0])}/><small>{file?.name??"PNG, JPG, WebP (max 2 MiB)"}</small></label></div></BusinessSection>
    <BusinessSection title="Company Address" copy="Update your company address to ensure your contact information is always accurate and up to date."><div className="settings-fields two"><BusinessField className="wide" label="Street Address" value={draft.streetAddress} required onChange={value=>set("streetAddress",value)}/><BusinessField label="Zip Code" value={draft.zipCode} required pattern="[A-Za-z0-9 -]{2,20}" onChange={value=>set("zipCode",value)}/><BusinessField label="City" value={draft.city} required onChange={value=>set("city",value)}/><BusinessField label="State" value={draft.state} required onChange={value=>set("state",value)}/><BusinessField label="Country" value={draft.country} required onChange={value=>set("country",value)}/></div></BusinessSection>
    <footer><button type="button" disabled={saving} onClick={cancel}>Cancel</button><button className="button button-primary" disabled={saving}>{saving?"Saving...":"Save Changes"}</button></footer>
  </form>;
}
function BusinessSection({title,copy,children}:{title:string;copy:string;children:React.ReactNode}){return <section className="settings-section"><div><h2>{title}</h2><p>{copy}</p></div>{children}</section>;}
function BusinessField({label,value,onChange,required,readOnly,className,type="text",pattern}:{label:string;value:string;onChange?:(value:string)=>void;required?:boolean;readOnly?:boolean;className?:string;type?:"text"|"email";pattern?:string}){return <label className={className}>{label}{required&&" *"}<input type={type} value={value} required={required} readOnly={readOnly} pattern={pattern} onChange={event=>onChange?.(event.target.value)}/></label>;}
