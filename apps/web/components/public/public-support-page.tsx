"use client";

import { FormEvent, useRef, useState } from "react";
import { PublicHeader } from "../auth/public-header";
import { PublicSiteFooter } from "./public-site-footer";

const questions = [
  { question: "How do I search for properties on Beryl Prestige Living?", answer: "Use the search bar on the Home page to search by title/keyword, then refine results using filters like Location, Property Type, Budget, and Bedrooms. You can also browse all listings from the “Buy” page and apply filters there." },
  { question: "How do I list a property for sale?", answer: "Sign in and open Dashboard Listings to create a property listing. New listings are submitted for review." },
  { question: "How does the referral program work and when do I get paid?", answer: "You can refer a specific property from Listings or create a seller referral link in Dashboard Referrals. The program rate is 2%. Please contact support for questions about payment timing." },
  { question: "I can’t log in / verify my account. What should I do?", answer: "Use Forgot Password on the Login page if you need to reset your password. If verification or sign-in still fails, contact support using the details below." },
  { question: "How do I report a suspicious property or agent?", answer: "Use the form below to report an agent. For concerns about a property, contact support using the email or phone number below." },
];

export function PublicSupportPage() {
  const [searchInput, setSearchInput] = useState("");
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<number | null>(0);
  const [agentId, setAgentId] = useState("");
  const [agentName, setAgentName] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const matches = questions.map((item, index) => ({ ...item, index })).filter(item => `${item.question} ${item.answer}`.toLowerCase().includes(filter.toLowerCase()));

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilter(searchInput.trim());
    setOpen(null);
    document.getElementById("support-faq")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setFeedback(null);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!base) throw new Error("Support is not configured.");
      const response = await fetch(`${base.replace(/\/$/, "")}/api/v1/public/support/reports`, {
        method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType: "AGENT", agentId, agentName, reason }),
      });
      const result: { success?: boolean; error?: { message?: string } } = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "Your report could not be submitted. Please try again.");
      setAgentId(""); setAgentName(""); setReason("");
      setFeedback({ kind: "success", text: "Your report was submitted successfully." });
    } catch {
      setFeedback({ kind: "error", text: "Your report could not be submitted. Please try again." });
    } finally { pendingRef.current = false; setPending(false); }
  }

  return <div className="public-page support-page"><PublicHeader sessionAware mobileMenu/><main>
    <section className="support-hero"><div className="support-hero-inner"><b>SUPPORT</b><h1>Welcome to Beryl Prestige Living Support</h1><p>If you need any assistance with buying, selling, or managing your property, you&apos;ve come to the right place. Our support team is here to help with any inquiries or issues you may have.</p>
      <form onSubmit={search} role="search"><input type="search" aria-label="Search support FAQs" placeholder="Search for what you’re looking for" value={searchInput} onChange={event=>setSearchInput(event.target.value)}/><button type="submit">Search</button></form>
    </div></section>
    <section className="support-faq support-content" id="support-faq"><header><h2>General FAQs</h2><p>Here are answers to common questions about Beryl Prestige Living. If you don&apos;t find what you need, contact support and we&apos;ll help.</p></header><div className="support-faq-list">
      {matches.length ? matches.map(item=><article className="support-faq-item" key={item.index}><h3><button type="button" aria-expanded={open===item.index} aria-controls={`support-answer-${item.index}`} onClick={()=>setOpen(value=>value===item.index?null:item.index)}>{item.question}<span aria-hidden="true">⌄</span></button></h3>{open===item.index&&<p id={`support-answer-${item.index}`}>{item.answer}</p>}</article>) : <p className="support-no-results">No matching FAQ found. Please contact support below.</p>}
    </div></section>
    <section className="support-contact support-content"><h2>Contact Support</h2><p>Didn&apos;t find your answer in the FAQ? Have questions, complaints, suggestions, or want to report a property or agent?</p><a className="support-contact-button" href="#support-report">Contact Us</a><span className="support-or">OR</span><div className="support-contact-grid"><div><span aria-hidden="true">✉</span><a href="mailto:info@berylprestigeliving.com">info@berylprestigeliving.com</a></div><div><span aria-hidden="true">●</span><p>Plot 2, Cornerstone Estate Drive,<br/>Ikate-Elegshi, Lekki, Lagos</p></div><div><span aria-hidden="true">☎</span><a href="tel:+2347042055678">+234 704 205 5678</a></div></div></section>
    <section className="support-report support-content" id="support-report"><header><h2>What are you reporting?</h2><p>We are committed to maintaining the highest standards in real estate services. If you have concerns regarding a property or an agent, please let us know. Your feedback helps keep Beryl Prestige Living safe and trustworthy for everyone.</p></header><form onSubmit={submit}><div className="support-report-fields"><label>Who are you reporting <span>*</span><select name="reportType" value="AGENT" required onChange={()=>{}}><option value="AGENT">Agent</option></select></label><label>Agent ID <span>*</span><input name="agentId" placeholder="Enter Agent ID" required maxLength={80} value={agentId} onChange={event=>setAgentId(event.target.value)}/></label></div><label>Agent Name <small>(Optional)</small><input name="agentName" placeholder="Enter name (Optional)" maxLength={120} value={agentName} onChange={event=>setAgentName(event.target.value)}/></label><label>Reason for Report <span>*</span><textarea name="reason" placeholder="Describe what happened" required maxLength={3000} value={reason} onChange={event=>setReason(event.target.value)}/></label><button type="submit" disabled={pending}>{pending?"Submitting…":"Submit Report"}</button>{feedback&&<p className={`support-feedback ${feedback.kind}`} role={feedback.kind==="error"?"alert":"status"}>{feedback.text}</p>}</form></section>
  </main><PublicSiteFooter/></div>;
}
