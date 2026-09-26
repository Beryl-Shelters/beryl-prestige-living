"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { Customer } from "../../lib/auth-api";
import { submitPublicInquiry } from "../../lib/public-inquiries-api";

const inquiryTypes=["Property Inquiry","Buying a Property","Selling/Listing a Property","Property Viewing","General Inquiry","Other"] as const;
const contexts:Record<string,{title:string;copy:string;source:string}>={
  "/":{title:"Home",copy:"Search for properties and explore Beryl services. You can also refer buyers or sellers.",source:"home"},
  "/about":{title:"About",copy:"Learn about Beryl Shelter, our leadership, vision, and office locations.",source:"about"},
  "/referrals":{title:"Referrals",copy:"Refer someone to buy or sell a property through the available referral options.",source:"referrals"},
  "/buy":{title:"Buy",copy:"Search and filter currently listed properties to find options that suit your needs.",source:"buy"},
  "/sell":{title:"Sell / List a Property",copy:"Sign in or create an account to list a property and manage its submission.",source:"sell"},
  "/analytics":{title:"Analytics & Insights",copy:"Review current public property and search insights across Beryl Shelter.",source:"analytics"},
  "/careers":{title:"Careers",copy:"Explore available roles and submit an application to join the Beryl team.",source:"careers"},
  "/support":{title:"Support",copy:"Browse common questions, contact Beryl, or report a property or agent.",source:"support"},
  "/saved-properties":{title:"Saved Properties",copy:"Review and manage the currently listed properties saved to your account.",source:"saved-properties"},
  "/compare-properties":{title:"Compare Properties",copy:"Select two or three saved properties to compare their key details.",source:"compare-properties"},
  "/mortgage-calculator":{title:"Mortgage Calculator",copy:"Estimate monthly loan repayment using your price, down payment, term, and rate.",source:"mortgage-calculator"},
};
const fallback={title:"Beryl Shelter Help",copy:"Need guidance using this page? Send our real estate team an inquiry.",source:"other"};

export function FloatingHelp({pathname,customer}:{pathname:string;customer:Customer|null}){
  const context=useMemo<{title:string;copy:string;source:string}>(()=>contexts[pathname]??(pathname.startsWith("/compare-properties")?contexts["/compare-properties"]!:fallback),[pathname]);
  const [helpOpen,setHelpOpen]=useState(false),[modalOpen,setModalOpen]=useState(false),[pending,setPending]=useState(false),[success,setSuccess]=useState(false),[failure,setFailure]=useState("");
  const [values,setValues]=useState({inquiryType:"",name:"",phone:"",email:"",message:""});const [errors,setErrors]=useState<Record<string,string>>({});
  const floating=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null);
  function freshValues(){return{inquiryType:"",name:[customer?.first_name,customer?.last_name].filter(Boolean).join(" "),phone:"",email:customer?.email??"",message:""}}
  function openModal(){setHelpOpen(false);setValues(freshValues());setErrors({});setFailure("");setSuccess(false);setModalOpen(true)}
  function closeModal(){setModalOpen(false);setPending(false);if(success)setValues(freshValues());setSuccess(false);setTimeout(()=>floating.current?.focus(),0)}
  useEffect(()=>{if(!modalOpen)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";closeButton.current?.focus();return()=>{document.body.style.overflow=previous}},[modalOpen]);
  useEffect(()=>{if(!helpOpen||modalOpen)return;const close=(event:globalThis.KeyboardEvent)=>{if(event.key==="Escape"){setHelpOpen(false);floating.current?.focus()}};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close)},[helpOpen,modalOpen]);
  function modalKeys(event:KeyboardEvent<HTMLDivElement>){if(event.key==="Escape"){event.preventDefault();closeModal();return}if(event.key!=="Tab"||!dialog.current)return;const items=[...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]),select:not([disabled]),input:not([disabled]),textarea:not([disabled]),a[href]')];const first=items[0];if(!first)return;const last=items.at(-1)!;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}
  async function submit(event:FormEvent){event.preventDefault();const next:Record<string,string>={};if(!inquiryTypes.includes(values.inquiryType as typeof inquiryTypes[number]))next.inquiryType="Select an Inquiry Type.";if(values.name.trim().length<2)next.name="Enter your full name.";if(!/^\+?[0-9()\-\s]{7,25}$/.test(values.phone.trim()))next.phone="Enter a valid contact number.";if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))next.email="Enter a valid email address.";if(values.message.trim().length<2)next.message="Describe what you need help with.";setErrors(next);if(Object.keys(next).length)return;setPending(true);setFailure("");try{await submitPublicInquiry({...values,name:values.name.trim(),phone:values.phone.trim(),email:values.email.trim().toLowerCase(),message:values.message.trim(),sourcePage:context.source});setSuccess(true)}catch(error){setFailure(error instanceof Error?error.message:"Your inquiry could not be submitted. Please try again.")}finally{setPending(false)}}
  const field=(key:keyof typeof values,value:string)=>setValues(current=>({...current,[key]:value}));
  return <><button ref={floating} className={`floating-help-button${helpOpen?" open":""}`} type="button" aria-label={helpOpen?"Close help":"Open help"} aria-expanded={helpOpen} onClick={()=>setHelpOpen(value=>!value)}>{helpOpen?"×":"?"}</button>
    {helpOpen&&<section className="context-help-card" role="dialog" aria-label={`${context.title} help`} onKeyDown={event=>{if(event.key==="Escape"){setHelpOpen(false);floating.current?.focus()}}}><h2>{context.title}</h2><p>{context.copy}</p><button type="button" className="context-more" onClick={openModal}>Need More Help</button><button type="button" className="context-dismiss" onClick={()=>{setHelpOpen(false);floating.current?.focus()}}>Dismiss</button></section>}
    {modalOpen&&<div className="inquiry-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)closeModal()}}><div ref={dialog} className="inquiry-dialog" role="dialog" aria-modal="true" aria-labelledby="inquiry-title" onKeyDown={modalKeys}><button ref={closeButton} className="inquiry-close" type="button" aria-label="Close inquiry form" onClick={closeModal}>×</button>
      <aside className="inquiry-expert"><Image src="/landing/landingpagehero_desktop.png" alt="Modern residential property" fill sizes="(max-width: 700px) 100vw, 42vw"/><div><h2>To speak with a<br/>Real Estate Expert</h2><p>Please Call:</p><a href="tel:+2347042055678">0704 205 5678</a></div></aside>
      <section className="inquiry-form-panel"><h1 id="inquiry-title">Real Estate Inquiry Form</h1>{success?<div className="inquiry-success" role="status"><h2>Inquiry received</h2><p>Thank you. A Beryl Shelter representative will follow up using the contact details provided.</p><button type="button" onClick={closeModal}>Close</button></div>:<form onSubmit={submit} noValidate>
        <label>Inquiry Type <b>*</b><select value={values.inquiryType} aria-invalid={!!errors.inquiryType} onChange={event=>field("inquiryType",event.target.value)}><option value="">Select Inquiry Type</option>{inquiryTypes.map(type=><option key={type}>{type}</option>)}</select>{errors.inquiryType&&<span role="alert">{errors.inquiryType}</span>}</label>
        <div className="inquiry-pair"><label>Your Name <b>*</b><input value={values.name} maxLength={120} placeholder="Enter full name" aria-invalid={!!errors.name} onChange={event=>field("name",event.target.value)}/>{errors.name&&<span role="alert">{errors.name}</span>}</label><label>Contact Number <b>*</b><input value={values.phone} maxLength={25} inputMode="tel" placeholder="Phone Number" aria-invalid={!!errors.phone} onChange={event=>field("phone",event.target.value)}/>{errors.phone&&<span role="alert">{errors.phone}</span>}</label></div>
        <label>Contact Email <b>*</b><input type="email" value={values.email} maxLength={254} placeholder="email@example.com" aria-invalid={!!errors.email} onChange={event=>field("email",event.target.value)}/>{errors.email&&<span role="alert">{errors.email}</span>}</label>
        <label>What do you need help with? <b>*</b><textarea value={values.message} maxLength={3000} placeholder="Describe your inquiry" aria-invalid={!!errors.message} onChange={event=>field("message",event.target.value)}/>{errors.message&&<span role="alert">{errors.message}</span>}</label>
        {failure&&<p className="inquiry-failure" role="alert">{failure}</p>}<button className="inquiry-submit" type="submit" disabled={pending}>{pending?"Submitting…":"Submit Inquiry"}</button><p className="inquiry-or">or</p><button className="inquiry-whatsapp" type="button" disabled aria-disabled="true" title="WhatsApp contact is not configured">Chat us on WhatsApp <span aria-hidden="true">◉</span></button>
      </form>}</section></div></div>}
  </>;
}
