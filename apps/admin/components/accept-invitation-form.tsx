"use client";
import { useEffect,useRef,useState,type FormEvent } from "react";
import { adminApi } from "../lib/api";

type Preview={fullName:string;email:string;department:"TECH"|"MANAGEMENT";role:"ADMIN"|"SUPER_ADMIN";expiresAt:string};

export function AcceptInvitationForm(){
  const token=useRef("");
  const [preview,setPreview]=useState<Preview|null>(null),[error,setError]=useState(""),[done,setDone]=useState(false),[pending,setPending]=useState(false);
  useEffect(()=>{
    const value=new URLSearchParams(window.location.hash.slice(1)).get("token")??"";
    history.replaceState(null,"",window.location.pathname);
    token.current=value;
    if(!value){queueMicrotask(()=>setError("This invitation is invalid or expired."));return;}
    adminApi<{invitation:Preview}>("/invitations/validate",{method:"POST",body:JSON.stringify({token:value})})
      .then(data=>setPreview(data.invitation))
      .catch(reason=>setError(reason instanceof Error?reason.message:"This invitation is invalid or expired."));
  },[]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setPending(true);setError("");
    const data=new FormData(event.currentTarget);
    try{
      await adminApi("/invitations/accept",{method:"POST",body:JSON.stringify({token:token.current,password:data.get("password"),confirmPassword:data.get("confirmPassword")})});
      setDone(true);
    }catch(reason){setError(reason instanceof Error?reason.message:"Account setup failed.");setPending(false);}
  }
  return <main className="auth-page"><section className="auth-card"><span className="eyebrow">Beryl Shelter</span><h1>Set up your Admin account</h1>{done?<><p>Your Admin account is ready.</p><a className="button-link" href="/login">Continue to Admin login</a></>:<>{preview&&<div className="invite-identity"><strong>{preview.fullName}</strong><span>{preview.email}</span><span>{preview.department==="TECH"?"Tech":"Management"} · {preview.role==="SUPER_ADMIN"?"Super Admin":"Admin"}</span></div>}{!preview&&!error&&<p>Validating invitation…</p>}{preview&&<form onSubmit={submit}><label>Password<input type="password" name="password" autoComplete="new-password" minLength={8} required/></label><label>Confirm Password<input type="password" name="confirmPassword" autoComplete="new-password" minLength={8} required/></label><button disabled={pending}>{pending?"Setting up…":"Set Password"}</button></form>}{error&&<p role="alert" className="form-error">{error}</p>}</>}</section></main>;
}
