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
const display=(value:string|number|null)=>value===null||value===""?"—":String(value);
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
  const first=data.total===0?0:(page-1)*data.pageSize+1,last=Math.min(page*data.pageSize,data.total);
  return <section className="referrals-page">
    <h1>Referrals</h1>
    <div className="referrals-layout">
      <section className="dashboard-card referrals-earn"><h2>Earn with Beryl Prestige Livings</h2><p>Invite your friends to Beryl Shelter and earn {rate}% when a referred property purchase is completed offline and verified by Beryl.</p>
        <div className="referrals-flow">{[["send","Send Invitation","Refer a property to friends and potential buyers and tell them about Beryl Shelter"],["register","Registration and Purchase","Your referral registers using your referral code; any property purchase is completed offline"],["reward","Referral Reward",`After Beryl verifies the completed sale, you receive the ${rate}% referral commission`]].map(([kind,title,copy],index)=><div key={title} className="referral-flow-step"><FlowIcon kind={kind as "send"|"register"|"reward"}/>{index<2&&<i aria-hidden="true"/>}<span className="referral-step-label">STEP {index+1}</span><h3>{title}</h3><p>{copy}</p></div>)}</div>
      </section>
      <section className="dashboard-card referrals-invite"><div className="referrals-invite-head"><h2>Invite your friends</h2><p>Invite your friends by referring properties they might want to purchase or by encouraging them to list their properties for sale with us.</p></div><div className="referral-actions"><div><span>Refer a property to a friend?</span><Link href="/buy">View Properties</Link></div><div><span>Know someone who has a property to sell?</span><button type="button" disabled={creating} onClick={()=>void referSeller()}>Refer a Friend to Sell</button></div></div><p>Earn <strong>{rate}% commission</strong> for every completed property purchase verified and attributed to your referral.</p></section>
      <div className="referral-kpis">{[["Available Balance",money(data.summary.availableBalance),"♨"],["Your Earnings",money(data.summary.totalEarnings),"₦"],["Referrals",data.summary.referrals,"⠿"],["Properties Sold",data.summary.propertiesSold,"▣"]].map(([label,value,icon])=><section className="dashboard-card referral-kpi" aria-label={String(label)} key={label}><span aria-hidden="true">{icon}</span><div><h2>{label}</h2><p>{value}</p></div></section>)}</div>
      <section className="dashboard-card referrals-history"><h2>Referral History</h2>{data.items.length?<><div className="referrals-table-scroll"><table className="referrals-table"><thead><tr>{["Reference","Referral Type","Completed Sale","Property Code","Earnings","Status","Payment","Completed"].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{data.items.map(item=><tr key={item.id}><td>{item.id}</td><td>{item.referralType}</td><td>{money(item.saleAmount)}</td><td>{display(item.propertyCode)}</td><td>{money(item.earnings)}</td><td>{item.status}</td><td>{item.paymentState==="PAID"?`Paid${item.paidAt?` · ${new Intl.DateTimeFormat("en-NG",{dateStyle:"medium"}).format(new Date(item.paidAt))}`:""}`:"Outstanding"}</td><td>{new Intl.DateTimeFormat("en-NG",{dateStyle:"medium"}).format(new Date(item.completedAt))}</td></tr>)}</tbody></table></div><footer className="referrals-history-footer"><span>Showing {first}-{last} of {data.total}</span>{data.totalPages>1&&<nav className="referrals-pagination" aria-label="Referral pages"><button disabled={page===1} onClick={()=>setPage(value=>value-1)}><span aria-hidden="true">‹</span><b>Previous</b></button><span aria-current="page">{page}</span><button disabled={page>=data.totalPages} onClick={()=>setPage(value=>value+1)}><b>Next</b><span aria-hidden="true">›</span></button></nav>}</footer></>:<div className="referrals-empty"><svg viewBox="0 0 80 72" aria-hidden="true"><path d="M16 51 42 34l22 9-27 18Z" fill="#e5e9ef"/><path d="M28 43V22h32v24" fill="#f4f6f9" stroke="#cbd2dc"/><circle cx="44" cy="31" r="6" fill="#b8c2cf"/><path d="M33 43c2-7 7-10 12-10s10 3 12 10" fill="#cbd2dc"/><path d="m14 42 8-8m-7 0 7 8M65 26l6-6m-5 0 5 6" stroke="#d0d6df" strokeWidth="3" strokeLinecap="round"/></svg><h3>No referrals yet</h3><p>Completed offline transactions attributed to your referrals will appear here after Beryl verifies them.</p></div>}</section>
    </div>
  </section>;
}
