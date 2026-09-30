"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { beginWithdrawal, listAdminWithdrawals, type WithdrawalQueuePage, type WithdrawalStatus } from "../lib/admin-referrers-api";
import { AdminAppShell } from "./admin-app-shell";
import { PaymentDialog, RejectDialog, viewReceipt } from "./admin-referrer-detail";

const statuses: (WithdrawalStatus|"ALL")[]=["ALL","PENDING","PROCESSING","PAID","REJECTED","CANCELLED"];
const money=(value:number)=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",minimumFractionDigits:2}).format(value/100).replace("NGN","₦");
const date=(value:string|null)=>value?new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value)):"—";

function Content(){
  const[status,setStatus]=useState<WithdrawalStatus|"ALL">("ALL"),[page,setPage]=useState(1),[revision,setRevision]=useState(0),[data,setData]=useState<WithdrawalQueuePage|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState<string|null>(null),[payment,setPayment]=useState<string|null>(null),[rejection,setRejection]=useState<string|null>(null),[notice,setNotice]=useState("");
  useEffect(()=>{const controller=new AbortController();listAdminWithdrawals(status,page,controller.signal).then(value=>{setData(value);setError("");}).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Withdrawals could not be loaded.");});return()=>controller.abort();},[status,page,revision]);
  const refresh=()=>setRevision(value=>value+1),closePayment=useCallback(()=>setPayment(null),[]),closeRejection=useCallback(()=>setRejection(null),[]);
  async function process(id:string){if(busy)return;setBusy(id);setError("");try{await beginWithdrawal(id);setNotice(`${id} is now processing.`);refresh();}catch(reason){setError(reason instanceof Error?reason.message:"Withdrawal could not begin processing.");}finally{setBusy(null);}}
  return <main className="admin-withdrawals-page">
    <header className="admin-directory-heading"><div><p>Referral operations</p><h1>Withdrawals</h1><span>Review and complete real customer withdrawal requests using the canonical payout ledger.</span></div></header>
    <nav aria-label="Withdrawal status filters" className="withdrawal-queue-filters">{statuses.map(value=><button aria-current={status===value?"page":undefined} key={value} onClick={()=>{setError("");setStatus(value);setPage(1);}}>{value==="ALL"?"All":value[0]+value.slice(1).toLowerCase()}</button>)}</nav>
    {notice&&<p className="admin-success-notice" role="status">{notice}</p>}
    {error&&<p className="admin-data-error" role="alert">{error}</p>}
    {!data&&!error?<div className="admin-directory-loading">Loading withdrawals…</div>:data?.items.length===0?<section className="referrer-empty"><span aria-hidden="true">₦</span><h2>No {status==="ALL"?"":status.toLowerCase()+" "}withdrawals</h2><p>Requests matching this status will appear here.</p></section>:data&&<section className="referrer-table-card" aria-busy={busy!==null}><div className="referrer-table-scroll"><table><thead><tr>{["Request","Customer / Referrer","Amount","Bank summary","Status","Requested","Updated","Actions"].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{data.items.map(item=><tr key={item.id}><td><strong>{item.id}</strong></td><td><strong>{item.referrerName}</strong><small>{item.referrerEmail}</small></td><td><strong>{money(item.amountMinor)}</strong></td><td>{item.bankName}<small>{item.maskedAccountNumber}</small></td><td><span className={`admin-withdrawal-status admin-withdrawal-status--${item.status.toLowerCase()}`}>{item.status}</span></td><td>{date(item.requestedAt)}</td><td>{date(item.updatedAt)}{item.rejectionReason&&<small>{item.rejectionReason}</small>}</td><td><div className="withdrawal-admin-actions"><Link className="withdrawal-inspect" href={`/dashboard/referrers/${item.referrerId}#withdrawals`}>Inspect</Link>{item.status==="PENDING"&&<><button disabled={busy===item.id} onClick={()=>void process(item.id)}>{busy===item.id?"Starting…":"Begin Processing"}</button><button className="reject-withdrawal" onClick={()=>setRejection(item.id)}>Reject</button></>}{item.status==="PROCESSING"&&<button className="mark-paid" onClick={()=>setPayment(item.id)}>Record Payment</button>}{item.status==="PAID"&&item.paymentId&&<button onClick={()=>void viewReceipt(item.paymentId!)}>View Receipt</button>}</div></td></tr>)}</tbody></table></div><footer><span>Showing {(data.page-1)*data.pageSize+1}–{Math.min(data.page*data.pageSize,data.total)} of {data.total}</span><nav aria-label="Withdrawal pages"><button disabled={data.page<=1} onClick={()=>setPage(value=>value-1)}>‹ Previous</button><span>Page {data.page} of {Math.max(1,data.totalPages)}</span><button disabled={data.page>=data.totalPages} onClick={()=>setPage(value=>value+1)}>Next ›</button></nav></footer></section>}
    {payment&&<PaymentDialog id={payment} kind="withdrawal" close={closePayment} paid={()=>{setPayment(null);setNotice(`${payment} was recorded as paid.`);refresh();}}/>}
    {rejection&&<RejectDialog id={rejection} close={closeRejection} rejected={()=>{setRejection(null);setNotice(`${rejection} was rejected and its reservation released.`);refresh();}}/>}
  </main>;
}

export function AdminWithdrawalsQueue(){return <AdminAppShell><Content/></AdminAppShell>;}
