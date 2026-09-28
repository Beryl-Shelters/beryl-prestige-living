"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter,useSearchParams } from "next/navigation";
import { useEffect,useState,type FormEvent } from "react";

import { listAdminProperties,type PropertyDirectoryPage,type PropertyDirectoryStatus,type PropertySort,type PropertyStatus } from "../lib/admin-properties-api";
import { AdminAppShell } from "./admin-app-shell";

const statuses:PropertyDirectoryStatus[]=["ALL","PENDING","LISTED","REJECTED"];
const sorts:PropertySort[]=["NEWEST","OLDEST","TITLE_ASC","TITLE_DESC"];
const labels:Record<PropertyStatus,string>={UNLISTED:"Unlisted",PENDING:"Pending Review",LISTED:"Approved",REJECTED:"Rejected"};

function date(value:string|null){return value?new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(value)):"—";}
function statusLabel(value:PropertyDirectoryStatus){return value==="ALL"?"All":labels[value];}
function statusCount(data:PropertyDirectoryPage,status:PropertyDirectoryStatus){return status==="ALL"?data.counts.all:status==="PENDING"?data.counts.pending:status==="LISTED"?data.counts.approved:data.counts.rejected;}

function DirectoryContent(){
  const router=useRouter(),params=useSearchParams();
  const search=params.get("search")?.slice(0,100)??"";
  const rawStatus=params.get("status")?.toUpperCase() as PropertyDirectoryStatus|null;
  const rawSort=params.get("sort")?.toUpperCase() as PropertySort|null;
  const status=rawStatus&&statuses.includes(rawStatus)?rawStatus:"ALL";
  const sort=rawSort&&sorts.includes(rawSort)?rawSort:"NEWEST";
  const rawPage=Number(params.get("page")??"1"),page=Number.isInteger(rawPage)&&rawPage>0?rawPage:1;
  const [data,setData]=useState<PropertyDirectoryPage|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");

  useEffect(()=>{const controller=new AbortController();queueMicrotask(()=>{if(!controller.signal.aborted){setLoading(true);setError("");}});listAdminProperties({search,status,sort,page},controller.signal).then(setData).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Properties could not be loaded.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[page,search,sort,status]);
  function update(values:Record<string,string|number|null>){const next=new URLSearchParams(params.toString());for(const [key,value] of Object.entries(values)){if(value===null||value===""||(key==="page"&&value===1)||(key==="status"&&value==="ALL")||(key==="sort"&&value==="NEWEST"))next.delete(key);else next.set(key,String(value));}router.replace(next.size?`/dashboard/properties?${next}`:"/dashboard/properties");}
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);update({search:String(form.get("search")??"").trim(),page:1});}

  const empty=status==="PENDING"?{title:"Queue’s clear",copy:"No properties waiting for review."}:status==="LISTED"?{title:"Nothing here yet",copy:"No approved properties so far."}:{title:"No matching properties",copy:"Try another search or status."};
  const first=data&&data.total?(data.page-1)*data.pageSize+1:0,last=data?Math.min(data.page*data.pageSize,data.total):0;
  return <main className="admin-properties-page">
    <header className="admin-page-heading"><h1>Properties</h1><p>Review submissions and control what goes live on the marketplace.</p></header>
    <section className="property-directory-controls">
      <div className="property-search-sort"><form role="search" onSubmit={submit}><span aria-hidden="true">⌕</span><input aria-label="Search properties" defaultValue={search} key={search} name="search" placeholder="Search by title, ID, seller or location"/><button type="submit">Search</button></form><label><span>Sort by</span><select aria-label="Sort properties" value={sort} onChange={event=>update({sort:event.target.value,page:1})}><option value="NEWEST">Newest submission</option><option value="OLDEST">Oldest submission</option><option value="TITLE_ASC">Title A–Z</option><option value="TITLE_DESC">Title Z–A</option></select></label></div>
      <nav aria-label="Property status filters" className="property-status-tabs">{statuses.map(value=><button aria-current={status===value?"page":undefined} className={status===value?"is-active":""} key={value} onClick={()=>update({status:value,page:1})} type="button"><span>{statusLabel(value)}</span><small>{data?statusCount(data,value):0}</small></button>)}</nav>
    </section>
    {error&&<p className="admin-data-error" role="alert">{error}</p>}
    {loading&&!data?<div className="admin-directory-loading" role="status">Loading properties…</div>:data&&data.items.length===0?<section className="property-empty-state"><span aria-hidden="true">▰</span><h2>{empty.title}</h2><p>{empty.copy}</p></section>:data&&<section aria-busy={loading} className="property-table-card"><div className="property-table-scroll"><table><thead><tr><th>ID</th><th>Property</th><th>Category</th><th>Mandate</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead><tbody>{data.items.map(item=><tr key={item.id}><td>{item.code}</td><td><div className="property-name-cell">{item.thumbnailUrl?<Image alt="" height={46} src={item.thumbnailUrl} unoptimized width={58}/>:<span aria-hidden="true">⌂</span>}<span><strong>{item.title}</strong><small>{date(item.submittedAt??item.updatedAt)}</small></span></div></td><td><span className="property-category">⌂ {item.propertyType}</span></td><td>{item.hasMandate?<span className="property-mandate">Exclusive</span>:<span className="admin-empty-value">—</span>}</td><td>{[item.city,item.state].filter(Boolean).join(", ")}</td><td><span className={`property-status property-status--${item.status.toLowerCase()}`}>{labels[item.status]}</span></td><td><Link aria-label={`View ${item.title}`} className="property-row-action" href={`/dashboard/properties/${encodeURIComponent(item.code)}`}>⋮</Link></td></tr>)}</tbody></table></div><footer><span>Showing {first}–{last} of {data.total}</span><nav aria-label="Property pages"><button disabled={data.page<=1} onClick={()=>update({page:data.page-1})}>‹ Previous</button><span>Page {data.page} of {Math.max(data.totalPages,1)}</span><button disabled={data.page>=data.totalPages} onClick={()=>update({page:data.page+1})}>Next ›</button></nav></footer></section>}
  </main>;
}
export function AdminPropertiesDirectory(){return <AdminAppShell><DirectoryContent/></AdminAppShell>;}
