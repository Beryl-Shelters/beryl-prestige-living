"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { AuthApiError } from "../../lib/auth-api";
import { cancelWithdrawal, fetchWithdrawals, requestWithdrawal, type WithdrawalPage } from "../../lib/referrals-api";
import { BrandLoader } from "../auth/brand-loader";
import { showAuthError } from "../auth/toast-provider";

const money=(minor:number)=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",minimumFractionDigits:2}).format(minor/100).replace("NGN","₦");
const date=(value:string|null)=>value?new Intl.DateTimeFormat("en-NG",{dateStyle:"medium"}).format(new Date(value)):"—";
function formattedInput(value:string){const cleaned=value.replace(/,/g,"").replace(/[^\d.]/g,""),[whole="",...fraction]=cleaned.split("."),integer=(whole.replace(/^0+(?=\d)/,"")||"0").slice(0,13),decimal=fraction.join("").slice(0,2);return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g,",")}${cleaned.includes(".")?`.${decimal}`:""}`;}
function toMinor(value:string){const normalized=value.replace(/,/g,""),match=/^(\d+)(?:\.(\d{0,2}))?$/.exec(normalized);if(!match)return 0;return Number(match[1])*100+Number((match[2]??"").padEnd(2,"0"));}
function fromMinor(value:number){const whole=Math.floor(value/100),cents=String(value%100).padStart(2,"0");return `${whole.toLocaleString("en-US")}.${cents}`;}
function percentage(value:number,percent:number){if(percent===100)return value;return Math.floor(value/100)*percent+Math.floor((value%100)*percent/100);}

export function ReferralWithdrawalScreen(){
  const router=useRouter(),requestId=useRef(crypto.randomUUID());
  const[data,setData]=useState<WithdrawalPage|null>(null),[page,setPage]=useState(1),[revision,setRevision]=useState(0),[amount,setAmount]=useState(""),[pending,setPending]=useState(false),[cancelling,setCancelling]=useState<string|null>(null),[failed,setFailed]=useState(false);
  const failure=useCallback((error:unknown)=>{if(error instanceof AuthApiError&&error.status===401)router.replace("/login");else showAuthError(error,"withdrawal-error");},[router]);
  useEffect(()=>{const controller=new AbortController();fetchWithdrawals(page,controller.signal).then(value=>{if(!controller.signal.aborted){setData(value);setFailed(false);}}).catch(error=>{if(!controller.signal.aborted){setFailed(true);failure(error);}});return()=>controller.abort();},[failure,page,revision]);
  if(!data)return <section className="withdrawal-page"><Link className="withdrawal-back" href="/dashboard/referrals">‹ Back to referrals</Link><h1>Withdraw Earnings</h1>{failed?<button className="button button-primary" onClick={()=>setRevision(value=>value+1)}>Try again</button>:<BrandLoader/>}</section>;
  const amountMinor=toMinor(amount),valid=data.bank.complete&&amountMinor>=data.balance.minimumMinor&&amountMinor<=data.balance.availableMinor;
  async function submit(){if(!valid||pending)return;setPending(true);try{await requestWithdrawal(requestId.current,amountMinor);toast.success("Withdrawal request submitted");requestId.current=crypto.randomUUID();setAmount("");setPage(1);setRevision(value=>value+1);}catch(error){failure(error);}finally{setPending(false);}}
  async function cancel(id:string){if(cancelling)return;setCancelling(id);try{await cancelWithdrawal(id);toast.success("Withdrawal request cancelled");setRevision(value=>value+1);}catch(error){failure(error);}finally{setCancelling(null);}}
  return <section className="withdrawal-page">
    <Link className="withdrawal-back" href="/dashboard/referrals">‹ Back to referrals</Link><h1>Withdraw Earnings</h1>
    <div className="withdrawal-grid">
      <section className="dashboard-card withdrawal-balance"><span aria-hidden="true">▣</span><h2>Available Balance</h2><strong>{money(data.balance.availableMinor)}</strong><p>Minimum withdrawal: {money(data.balance.minimumMinor)}</p><dl><div><dt>Total earned</dt><dd>{money(data.balance.totalEarnedMinor)}</dd></div><div><dt>Pending</dt><dd>{money(data.balance.pendingMinor)}</dd></div><div><dt>Paid</dt><dd>{money(data.balance.totalPaidMinor)}</dd></div></dl></section>
      <section className="dashboard-card withdrawal-form"><h2>Enter Amount to Withdraw</h2><label className="withdrawal-amount"><span>₦</span><input aria-label="Withdrawal amount" inputMode="decimal" value={amount} onChange={event=>setAmount(formattedInput(event.target.value))} placeholder="0.00"/></label><p className="withdrawal-help">Enter an amount between {money(data.balance.minimumMinor)} and {money(data.balance.availableMinor)}.</p>
        <fieldset><legend>Quick Select</legend><div className="withdrawal-quick">{[25,50,75,100].map(value=><button disabled={data.balance.availableMinor===0} key={value} onClick={()=>setAmount(fromMinor(percentage(data.balance.availableMinor,value)))} type="button">{value}%</button>)}</div></fieldset>
        <div className={`withdrawal-bank${data.bank.complete?"":" is-missing"}`}><span aria-hidden="true">▣</span>{data.bank.complete?<div><strong>Registered bank destination</strong><p>{data.bank.accountName} · {data.bank.bankName} · {data.bank.maskedAccountNumber}</p></div>:<div><strong>Bank details required</strong><p>Add complete bank information in <Link href="/dashboard/settings">Settings</Link> before requesting a withdrawal.</p></div>}</div>
        <p className="withdrawal-notice">ⓘ Withdrawal requests are reviewed and processed by Beryl using your registered bank details. Submitting this request does not transfer money automatically.</p>
        <button className="withdrawal-submit" disabled={!valid||pending} onClick={()=>void submit()}>{pending?"Submitting…":"Submit Withdrawal Request"}</button>
      </section>
    </div>
    <section className="dashboard-card withdrawal-history"><h2>Recent Withdrawals</h2>{data.items.length?<><div className="withdrawal-table-scroll"><table><thead><tr>{["Reference","Amount","Requested","Status","Paid","Details","Action"].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{data.items.map(item=><tr key={item.id}><td><strong>{item.id}</strong></td><td>{money(item.amountMinor)}</td><td>{date(item.requestedAt)}</td><td><span className={`withdrawal-status withdrawal-status--${item.status.toLowerCase()}`}>{item.status}</span></td><td>{date(item.paidAt)}</td><td>{item.rejectionReason??(item.status==="PROCESSING"?"Beryl is processing the external payment.":item.status==="PENDING"?"Awaiting review.":"—")}</td><td>{item.status==="PENDING"?<button className="withdrawal-cancel" disabled={cancelling===item.id} onClick={()=>void cancel(item.id)}>{cancelling===item.id?"Cancelling…":"Cancel"}</button>:"—"}</td></tr>)}</tbody></table></div><footer><span>Showing {(data.page-1)*data.pageSize+1}–{Math.min(data.page*data.pageSize,data.total)} of {data.total}</span>{data.totalPages>1&&<nav aria-label="Withdrawal pages"><button disabled={data.page<=1} onClick={()=>setPage(value=>value-1)}>‹ Previous</button><span>Page {data.page} of {data.totalPages}</span><button disabled={data.page>=data.totalPages} onClick={()=>setPage(value=>value+1)}>Next ›</button></nav>}</footer></>:<div className="withdrawal-empty"><span aria-hidden="true">▣</span><h3>No withdrawal requests yet</h3><p>Your real withdrawal requests will appear here.</p></div>}</section>
  </section>;
}
