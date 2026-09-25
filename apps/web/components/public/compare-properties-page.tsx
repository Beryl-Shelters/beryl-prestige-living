"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Customer } from "../../lib/auth-api";
import { fetchComparedProperties, fetchSavedProperties, removeSavedProperty, type SavedPropertiesApiError } from "../../lib/saved-properties-api";
import type { PublicProperty, PublicPropertyPage } from "../../lib/public-properties-api";
import { formatNaira } from "../../lib/buy-query";
import { PublicHeader } from "../auth/public-header";
import { PublicSiteFooter } from "./public-site-footer";

function SearchIcon(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg>}
function TrashIcon(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/></svg>}
function ShareIcon(){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5m-7.6 6.9 7.6 4.5"/></svg>}

function PropertyImage({property}:{property:PublicProperty}){return property.images[0]?<Image src={property.images[0]} alt={`Exterior of ${property.title}`} width={640} height={450} unoptimized/>:<div className="compare-image-placeholder" role="img" aria-label={`No photograph available for ${property.title}`}>Photo unavailable</div>}

function ComparisonPanel({selected,remove,clear,submit}:{selected:PublicProperty[];remove:(code:string)=>void;clear:()=>void;submit:()=>void}){
  return <aside className="compare-selection-panel" aria-label="Comparison selection"><h2>Compare</h2><p>{selected.length} of 3 {selected.length===1?"Property":"Properties"} Selected</p><div className="compare-selection-slots">
    {[0,1,2].map(index=>{const property=selected[index];return property?<div className="compare-selection-thumb" key={property.code}><PropertyImage property={property}/><button type="button" aria-label={`Remove ${property.title} from comparison`} onClick={()=>remove(property.code)}>×</button></div>:<div className="compare-selection-empty" aria-label="Empty comparison slot" key={`empty-${index}`}><span>⌂</span></div>})}
  </div><div className="compare-selection-actions"><button type="button" className="compare-clear" disabled={!selected.length} onClick={clear}>Clear All</button><button type="button" className="compare-submit" disabled={selected.length<2} aria-disabled={selected.length<2} onClick={submit}>Compare Properties</button></div></aside>
}

function CompareCard({property,selected,limit,onToggle,onUnsave}:{property:PublicProperty;selected:boolean;limit:boolean;onToggle:()=>void;onUnsave:()=>void}){
  const [shareStatus,setShareStatus]=useState("");
  async function share(){const url=`${window.location.origin}/buy?code=${encodeURIComponent(property.code)}`;try{if(navigator.share)await navigator.share({title:property.title,url});else{await navigator.clipboard.writeText(url);setShareStatus("Property link copied.")}}catch(error){if((error as DOMException).name!=="AbortError")setShareStatus("Could not share this property.")}}
  return <article className="compare-property-card"><div className="compare-property-image"><PropertyImage property={property}/><button type="button" className="compare-card-action compare-trash" aria-label={`Remove ${property.title} from saved properties`} onClick={onUnsave}><TrashIcon/></button><button type="button" className="compare-card-action compare-share" aria-label={`Share ${property.title}`} onClick={()=>void share()}><ShareIcon/></button></div>
    <h2>{property.title}</h2><div className="compare-property-facts"><span>▱ {property.bedrooms} {property.bedrooms===1?"Bedroom":"Bedrooms"}</span><span>♧ {property.bathrooms} {property.bathrooms===1?"Bathroom":"Bathrooms"}</span><span>▣ {property.parkingSpaces} {property.parkingSpaces===1?"Parking Space":"Parking Spaces"}</span></div>
    <div className="compare-card-bottom"><strong>{formatNaira(property.priceMinor)}</strong><button type="button" aria-pressed={selected} disabled={!selected&&limit} title={!selected&&limit?"Maximum of 3 properties selected":undefined} onClick={onToggle}>{selected?"Remove":"Compare"}</button></div>{shareStatus&&<span className="compare-card-status" role="status">{shareStatus}</span>}</article>
}

export function ComparePropertiesPage(){
  const router=useRouter(),params=useSearchParams(),initialCodeParam=params.get("codes")??"";const initialCodes=useMemo(()=>{const values=initialCodeParam.split(",").map(value=>value.trim()).filter(Boolean);return values.length>=2&&values.length<=3&&new Set(values).size===values.length?values:[]},[initialCodeParam]);
  const [customer,setCustomer]=useState<Customer|null|undefined>(undefined);const [draft,setDraft]=useState("");const [query,setQuery]=useState("");const [page,setPage]=useState(1);const [retry,setRetry]=useState(0);
  const [requestState,setRequestState]=useState<{key:string;result:PublicPropertyPage|null;error:string}|null>(null);const [selected,setSelected]=useState<PublicProperty[]>([]);const [removing,setRemoving]=useState<string|null>(null);
  const hydratedSelection=useRef<string|null>(null);
  const onSessionChange=useCallback((value:Customer|null)=>setCustomer(value),[]);const requestKey=`${customer?.id??"guest"}:${query}:${page}:${retry}`;const result=requestState?.key===requestKey?requestState.result:null;const loading=!!customer&&requestState?.key!==requestKey;
  useEffect(()=>{if(customer===null)router.replace(`/login?next=${encodeURIComponent("/compare-properties")}`)},[customer,router]);
  useEffect(()=>{if(!customer)return;const controller=new AbortController(),search=new URLSearchParams({page:String(page),pageSize:"12"});if(query)search.set("q",query);void fetchSavedProperties(search,controller.signal).then(value=>{if(!controller.signal.aborted)setRequestState({key:requestKey,result:value,error:""})}).catch((error:SavedPropertiesApiError)=>{if(!controller.signal.aborted)setRequestState({key:requestKey,result:null,error:error.message||"Saved properties are temporarily unavailable."})});return()=>controller.abort()},[customer,page,query,retry,requestKey]);
  useEffect(()=>{if(!customer||initialCodes.length<2)return;const hydrationKey=`${customer.id}:${initialCodes.join(",")}`;if(hydratedSelection.current===hydrationKey)return;hydratedSelection.current=hydrationKey;const controller=new AbortController();void fetchComparedProperties(initialCodes,controller.signal).then(value=>{if(!controller.signal.aborted)setSelected(value.items)}).catch(()=>{});return()=>{controller.abort();if(hydratedSelection.current===hydrationKey)hydratedSelection.current=null}},[customer,initialCodes]);
  function search(event:FormEvent){event.preventDefault();setPage(1);setQuery(draft.trim())}
  function toggle(property:PublicProperty){setSelected(current=>current.some(item=>item.code===property.code)?current.filter(item=>item.code!==property.code):current.length<3?[...current,property]:current)}
  async function unsave(property:PublicProperty){if(removing)return;setRemoving(property.code);try{await removeSavedProperty(property.code);setSelected(current=>current.filter(item=>item.code!==property.code));setRetry(value=>value+1)}finally{setRemoving(null)}}
  function compare(){if(selected.length>=2)router.push(`/compare-properties/compare?${new URLSearchParams({codes:selected.map(item=>item.code).join(",")})}`)}
  return <div className="compare-properties-page"><PublicHeader sessionAware mobileMenu onSessionChange={onSessionChange}/><main><section className="compare-properties-hero"><h1>Compare Saved Properties</h1><form className="compare-properties-search" role="search" onSubmit={search}><label htmlFor="compare-property-search">Search your saved properties</label><SearchIcon/><input id="compare-property-search" type="search" maxLength={100} placeholder="Search your saved properties" value={draft} onChange={event=>setDraft(event.target.value)}/><button type="submit">Search</button></form></section>
    <div className="compare-properties-layout"><ComparisonPanel selected={selected} remove={code=>setSelected(current=>current.filter(item=>item.code!==code))} clear={()=>setSelected([])} submit={compare}/><section className="compare-properties-content" aria-live="polite">
      {customer===undefined||loading?<div className="compare-state" role="status">Loading saved properties…</div>:requestState?.key===requestKey&&requestState.error?<div className="compare-state" role="alert"><strong>{requestState.error}</strong><button type="button" onClick={()=>setRetry(value=>value+1)}>Try again</button></div>:result?.items.length?<><div className="compare-properties-grid">{result.items.map(property=><CompareCard key={property.code} property={property} selected={selected.some(item=>item.code===property.code)} limit={selected.length>=3} onToggle={()=>toggle(property)} onUnsave={()=>void unsave(property)}/>)}</div>{result.totalPages>1&&<nav className="compare-pagination" aria-label="Saved properties pages"><button type="button" disabled={page<=1} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {result.page} of {result.totalPages}</span><button type="button" disabled={page>=result.totalPages} onClick={()=>setPage(value=>value+1)}>Next</button></nav>}</>:<div className="compare-state"><strong>{query?"No saved properties match your search.":"You have no saved properties yet."}</strong>{query&&<button type="button" onClick={()=>{setDraft("");setQuery("");setPage(1)}}>Clear search</button>}</div>}
    </section></div></main><PublicSiteFooter/></div>
}
