"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback,useEffect,useRef,useState } from "react";
import { AuthApiError } from "../../lib/auth-api";
import { createReferral,fetchReferrals,type ReferralPage } from "../../lib/referrals-api";
import { BrandLoader } from "../auth/brand-loader";
import { showAuthError } from "../auth/toast-provider";
import { toast } from "react-toastify";

const money=(minor:number)=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",minimumFractionDigits:2}).format(minor/100).replace("NGN","₦");
const display=(value:string|number|null)=>value===null||value===""?"-":String(value);
function FlowIcon({kind}:{kind:"send"|"register"|"reward"}){return <span className="referral-flow-icon" aria-hidden="true">{kind==="send"?"▤":kind==="register"?"♙+":"₦"}</span>;}

export function ReferralsScreen(){
  const router=useRouter(),writes=useRef(new Set<AbortController>());
  const [data,setData]=useState<ReferralPage|null>(null),[page,setPage]=useState(1),[revision,setRevision]=useState(0),[failed,setFailed]=useState(false),[creating,setCreating]=useState(false);
  const failure=useCallback((error:unknown)=>{if(error instanceof AuthApiError&&error.status===401)router.replace("/login");else showAuthError(error,"referrals-error");},[router]);
  useEffect(()=>{const controller=new AbortController();fetchReferrals(page,controller.signal).then(value=>{if(!controller.signal.aborted){setData(value);setFailed(false);}}).catch(error=>{if(!controller.signal.aborted){setData(null);setFailed(true);failure(error);}});return()=>controller.abort();},[failure,page,revision]);
  useEffect(()=>{const active=writes.current;return()=>{for(const controller of active)controller.abort();};},[]);
  async function referSeller(){if(creating)return;const controller=new AbortController();writes.current.add(controller);setCreating(true);try{const referral=await createReferral({type:"SELLER"},controller.signal);await navigator.clipboard.writeText(referral.referralUrl);toast.success("Referral link copied to clipboard");setRevision(value=>value+1);}catch(error){if(!controller.signal.aborted)failure(error);}finally{writes.current.delete(controller);if(!controller.signal.aborted)setCreating(false);}}
  if(!data)return <section className="referrals-page"><h1>Referrals</h1>{failed?<div className="referrals-retry"><button className="button button-primary" onClick={()=>{setFailed(false);setRevision(value=>value+1);}}>Try again</button></div>:<BrandLoader/>}</section>;
  const rate=data.program.commissionRateBasisPoints/100;
  return <section className="referrals-page">
    <h1>Referrals</h1>
    <div className="referrals-intro">
      <section className="dashboard-card referrals-earn"><h2>Earn with Beryl Shelter</h2><p>Invite your friends to Beryl Shelter and earn {rate}% of every property purchase they make through our platform. Start referring today and benefit from their investments!</p>
        <div className="referrals-flow">{[["send","Send Invitation","Refer a property to friends and potential buyers and tell them about Beryl Prestige Living"],["register","Registration and Purchase","Your referrals should register to our platform using your personal referral code"],["reward","Referral Reward",`Once they purchase a property through our platform you get a ${rate}% bonus on their purchase`]].map(([kind,title,copy],index)=><div key={title} className="referral-flow-step"><FlowIcon kind={kind as "send"|"register"|"reward"}/>{index<2&&<i aria-hidden="true"/>}<h3>{title}</h3><p>{copy}</p></div>)}</div>
      </section>
      <section className="dashboard-card referrals-invite"><h2>Invite your friends</h2><p>Invite your friends by referring properties they might want to purchase or by encouraging them to list their properties for sale with us.</p><div className="referral-actions"><div><span>Refer a property to a friend?</span><Link href="/dashboard/listings">View Properties</Link></div><div><span>Know someone who has a property to sell?</span><button type="button" disabled={creating} onClick={()=>void referSeller()}>Refer a Friend to Sell</button></div></div><p>Earn <strong>{rate}% commission</strong> for every property purchased through your referral.</p></section>
    </div>
    <div className="referral-kpis">{[["Available Balance",money(data.summary.availableBalance),"♨"],["Your Earnings",money(data.summary.totalEarnings),"₦"],["Referrals",data.summary.referrals,"⠿"],["Properties Sold",data.summary.propertiesSold,"▣"]].map(([label,value,icon])=><section className="dashboard-card referral-kpi" aria-label={String(label)} key={label}><span aria-hidden="true">{icon}</span><div><h2>{label}</h2><p>{value}</p></div></section>)}</div>
    <div className="referrals-table-scroll"><table className="referrals-table"><thead><tr>{["Id","Budget","Buyer Entity Type","Ownership Type","Contact Method","Property Code","Earnings","Status"].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{data.items.length?data.items.map(item=><tr key={item.id}><td>{item.id}</td><td>{item.budget===null?"-":money(item.budget)}</td><td>{display(item.buyerEntityType)}</td><td>{display(item.ownershipType)}</td><td>{display(item.contactMethod)}</td><td>{display(item.propertyCode)}</td><td>{money(item.earnings)}</td><td>{item.status}</td></tr>):<tr><td colSpan={8}>No Referrals Found</td></tr>}</tbody></table></div>
    {data.totalPages>1&&<nav className="referrals-pagination" aria-label="Referral pages"><button disabled={page===1} onClick={()=>setPage(value=>value-1)}>‹</button><span aria-current="page">{page}</span><button disabled={page>=data.totalPages} onClick={()=>setPage(value=>value+1)}>›</button></nav>}
  </section>;
}
