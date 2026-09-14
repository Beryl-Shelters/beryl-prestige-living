"use client";
/* Profile images are validated Cloudinary URLs; render them without an image proxy. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback,useEffect,useRef,useState } from "react";
import { toast } from "react-toastify";
import { AuthApiError } from "../../lib/auth-api";
import { changeSettingsPassword,fetchSettingsProfile,saveSettingsProfile,type SettingsProfile } from "../../lib/settings-api";
import { validateNewPassword } from "../../lib/password-policy";
import { BrandLoader } from "../auth/brand-loader";
import { PasswordVisibilityIcon } from "../auth/password-input";
import { showAuthError } from "../auth/toast-provider";
import { useDashboard } from "./dashboard-provider";

const label=(value:string|null)=>value?.split("_").map(word=>word[0]+word.slice(1).toLowerCase()).join(" ")??"Customer";

export function SettingsProfileScreen(){
  const router=useRouter(),{refreshOverview}=useDashboard(),[profile,setProfile]=useState<SettingsProfile|null>(null),
    [draft,setDraft]=useState<SettingsProfile|null>(null),[file,setFile]=useState<File>(),[failed,setFailed]=useState(false),
    [revision,setRevision]=useState(0),[saving,setSaving]=useState(false),[fileKey,setFileKey]=useState(0),[active,setActive]=useState<"profile"|"password">("profile"),
    [passwords,setPasswords]=useState({oldPassword:"",newPassword:"",confirmNewPassword:""}),
    form=useRef<HTMLFormElement>(null);
  const failure=useCallback((error:unknown)=>{
    if(error instanceof AuthApiError&&["SESSION_EXPIRED","AUTH_REQUIRED"].includes(error.code))router.replace("/login");
    else showAuthError(error,"settings-profile-error");
  },[router]);
  useEffect(()=>{
    const controller=new AbortController();
    fetchSettingsProfile(controller.signal).then(value=>{
      if(!controller.signal.aborted){setProfile(value);setDraft(value);setFailed(false);}
    }).catch(error=>{if(!controller.signal.aborted){setFailed(true);failure(error);}});
    return()=>controller.abort();
  },[failure,revision]);
  if(!draft)return <section className="settings-page"><h1>Account Settings</h1>{failed?
    <button className="button button-primary" onClick={()=>{setFailed(false);setRevision(value=>value+1);}}>Try again</button>:
    <BrandLoader/>}</section>;
  const set=(key:keyof SettingsProfile,value:string)=>setDraft(current=>current?{...current,[key]:value}:current);
  const initials=`${draft.firstName[0]??""}${draft.lastName[0]??""}`.toUpperCase();
  const avatar=(large=false)=><div className={`settings-avatar${large?" large":""}${draft.profileImageUrl?" has-image":""}`}>
    {draft.profileImageUrl?<img src={draft.profileImageUrl} alt="Profile"/>:initials}
  </div>;
  async function save(event:React.FormEvent){
    event.preventDefault();
    if(!form.current?.reportValidity()||saving)return;
    setSaving(true);
    try{
      const value=await saveSettingsProfile(draft!,file);
      setProfile(value);setDraft(value);setFile(undefined);setFileKey(value=>value+1);
      refreshOverview();
      toast.success("Profile updated successfully");
    }catch(error){failure(error);}finally{setSaving(false);}
  }
  function cancel(){if(profile){setDraft(profile);setFile(undefined);setFileKey(value=>value+1);}}
  const clearPasswords=()=>setPasswords({oldPassword:"",newPassword:"",confirmNewPassword:""});
  async function savePassword(event:React.FormEvent){event.preventDefault();if(saving)return;setSaving(true);try{validateNewPassword(passwords.newPassword,passwords.confirmNewPassword);if(passwords.oldPassword===passwords.newPassword)throw new Error("Choose a password different from your current password.");await changeSettingsPassword(passwords.oldPassword,passwords.newPassword,passwords.confirmNewPassword);clearPasswords();toast.success("Password changed successfully. Please log in again.");router.replace("/login");}catch(error){failure(error);}finally{setSaving(false);}}
  return <section className="settings-page">
    <h1>Account Settings</h1>
    <div className="settings-tabs" role="tablist" aria-label="Account settings">
      <button type="button" role="tab" aria-selected={active==="profile"} onClick={()=>setActive("profile")}>Profile</button>
      <button type="button" role="tab" aria-selected={active==="password"} onClick={()=>setActive("password")}>Password</button>
      <button role="tab" aria-selected="false" disabled>Business</button>
    </div>
    {active==="profile"?<form ref={form} onSubmit={save} className="dashboard-card settings-card">
      <header className="settings-identity">{avatar()}<strong>{label(draft.accountType)}</strong><Link href="/dashboard/kyc">Verify Account</Link></header>
      <SettingsSection title="Personal Information" copy="Manage and update your personal details to keep your account secure and up to date.">
        <div className="settings-fields two">
          <Field label="First Name" value={draft.firstName} required onChange={value=>set("firstName",value)}/>
          <Field label="Last Name" value={draft.lastName} required onChange={value=>set("lastName",value)}/>
          <Field label="Email Address" value={draft.email} readOnly/>
          <Field label="Phone Number" value={draft.phoneNumber} required inputMode="numeric" pattern="[0-9]{5,15}" onChange={value=>set("phoneNumber",value)}/>
          <label className="wide">Brief Bio<textarea maxLength={1000} value={draft.briefBio} onChange={event=>set("briefBio",event.target.value)} placeholder="Enter a brief bio"/></label>
        </div>
      </SettingsSection>
      <SettingsSection title="Profile Picture *" copy="Update your profile picture. This will be displayed publicly.">
        <div className="settings-picture">{avatar(true)}<label className="settings-upload">Click to upload or drag and drop
          <input key={fileKey} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={event=>setFile(event.target.files?.[0])}/>
          <small>{file?.name??"PNG, JPG, WebP (max 2 MiB)"}</small>
        </label></div>
      </SettingsSection>
      <SettingsSection title="Account Information" copy="Update your bank details. This is private and is only visible to Beryl Shelter.">
        <div className="settings-fields two">
          <Field label="Account Name" value={draft.accountName} className="wide" onChange={value=>set("accountName",value)}/>
          <Field label="Bank Name" value={draft.bankName} onChange={value=>set("bankName",value)}/>
          <Field label="Account Number" value={draft.accountNumber} inputMode="numeric" pattern="[0-9]{6,20}" onChange={value=>set("accountNumber",value)}/>
        </div>
      </SettingsSection>
      <SettingsSection title="Address" copy="Update your address to ensure your contact information is always accurate.">
        <div className="settings-fields two">
          <Field label="Street Address" value={draft.streetAddress} required className="wide" onChange={value=>set("streetAddress",value)}/>
          <Field label="Zip Code" value={draft.zipCode} required onChange={value=>set("zipCode",value)}/>
          <Field label="City" value={draft.city} required onChange={value=>set("city",value)}/>
          <Field label="State" value={draft.state} required onChange={value=>set("state",value)}/>
          <Field label="Country" value={draft.country} required onChange={value=>set("country",value)}/>
        </div>
      </SettingsSection>
      <footer><button type="button" disabled={saving} onClick={cancel}>Cancel</button><button className="button button-primary" disabled={saving}>{saving?"Saving...":"Save Changes"}</button></footer>
    </form>:<form onSubmit={savePassword} className="dashboard-card settings-card settings-password-card" aria-busy={saving}>
      <header className="settings-identity">{avatar()}<strong>{label(draft.accountType)}</strong><Link href="/dashboard/kyc">Verify Account</Link></header>
      <SettingsSection title="Password" copy="Manage your password here for enhanced security.">
        <div className="settings-fields settings-password-fields">
          <PasswordField label="Old Password" autoComplete="current-password" value={passwords.oldPassword} onChange={oldPassword=>setPasswords(value=>({...value,oldPassword}))}/>
          <PasswordField label="New Password" autoComplete="new-password" value={passwords.newPassword} onChange={newPassword=>setPasswords(value=>({...value,newPassword}))}/>
          <PasswordField label="Confirm New Password" autoComplete="new-password" value={passwords.confirmNewPassword} onChange={confirmNewPassword=>setPasswords(value=>({...value,confirmNewPassword}))}/>
        </div>
      </SettingsSection>
      <footer><button type="button" disabled={saving} onClick={clearPasswords}>Cancel</button><button className="button button-primary" disabled={saving}>{saving?"Saving...":"Save Changes"}</button></footer>
    </form>}
  </section>;
}
function SettingsSection({title,copy,children}:{title:string;copy:string;children:React.ReactNode}){return <section className="settings-section"><div><h2>{title}</h2><p>{copy}</p></div>{children}</section>;}
function Field({label,value,onChange,required,readOnly,className,inputMode,pattern}:{label:string;value:string;onChange?:(value:string)=>void;required?:boolean;readOnly?:boolean;className?:string;inputMode?:"numeric";pattern?:string}){return <label className={className}>{label}{required&&" *"}<input value={value} required={required} readOnly={readOnly} inputMode={inputMode} pattern={pattern} onChange={event=>onChange?.(event.target.value)}/></label>;}
function PasswordField({label,autoComplete,value,onChange}:{label:string;autoComplete:"current-password"|"new-password";value:string;onChange:(value:string)=>void}){const [visible,setVisible]=useState(false),id=`settings-${label.toLowerCase().replaceAll(" ","-")}`;return <div className="settings-password-field"><label htmlFor={id}>{label}</label><div className="password-control"><input id={id} required type={visible?"text":"password"} autoComplete={autoComplete} minLength={label==="Old Password"?1:8} maxLength={128} value={value} onChange={event=>onChange(event.target.value)}/><button type="button" className="password-toggle" aria-label={`${visible?"Hide":"Show"} ${label.toLowerCase()}`} onClick={()=>setVisible(current=>!current)}><PasswordVisibilityIcon visible={visible}/></button></div></div>;}
