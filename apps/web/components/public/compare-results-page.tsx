"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Customer } from "../../lib/auth-api";
import { formatNaira } from "../../lib/buy-query";
import { fetchComparedProperties, type ComparedProperty } from "../../lib/saved-properties-api";
import { PublicHeader } from "../auth/public-header";
import { PublicSiteFooter } from "./public-site-footer";

const rows:[string,(property:ComparedProperty)=>string][]=[
  ["Property Ref No.",p=>p.code],["Property Type",p=>p.propertyType],["Property Subtype",p=>p.propertySubtype],["Property Status",p=>p.propertyStatus],
  ["Number of Bedrooms",p=>String(p.bedrooms)],["Number of Bathrooms",p=>String(p.bathrooms)],["Parking Space",p=>String(p.parkingSpaces)],
  ["Unit Size (sqft)",p=>p.unitSizeSqft===null?"—":String(p.unitSizeSqft)],["Location",p=>[p.city,p.state].filter(Boolean).join(", ")||"—"],
  ["Year Built",p=>p.yearBuilt===null?"—":String(p.yearBuilt)],["Minimum Down Payment",p=>formatNaira(p.minimumDownPaymentMinor)],
];
function Header({property}:{property:ComparedProperty}){return <div className="comparison-property-header">{property.images[0]?<Image src={property.images[0]} alt={`Exterior of ${property.title}`} width={640} height={450} unoptimized/>:<div className="comparison-placeholder">Photo unavailable</div>}<h2>{property.title}</h2><div><span>▱ {property.bedrooms}</span><span>♧ {property.bathrooms}</span><span>▣ {property.parkingSpaces}</span></div><strong>{formatNaira(property.priceMinor)}</strong></div>}

export function CompareResultsPage(){const router=useRouter(),params=useSearchParams();const codes=useMemo(()=>{const values=(params.get("codes")??"").split(",").map(value=>value.trim()).filter(Boolean);return values.length>=2&&values.length<=3&&new Set(values).size===values.length?values:[]},[params]);
  const [customer,setCustomer]=useState<Customer|null|undefined>(undefined);const [items,setItems]=useState<ComparedProperty[]|null>(null);const [error,setError]=useState("");const onSessionChange=useCallback((value:Customer|null)=>setCustomer(value),[]);
  useEffect(()=>{if(customer===null)router.replace(`/login?next=${encodeURIComponent(`/compare-properties/compare${params.toString()?`?${params}`:""}`)}`)},[customer,router,params]);
  useEffect(()=>{if(!customer||codes.length<2)return;const controller=new AbortController();void fetchComparedProperties(codes,controller.signal).then(value=>{if(!controller.signal.aborted)setItems(value.items)}).catch(()=>{if(!controller.signal.aborted)setError("Comparison is temporarily unavailable. Please try again.")});return()=>controller.abort()},[customer,codes]);
  const unavailable=codes.length<2||items!==null&&items.length<2;
  return <div className="compare-results-page"><PublicHeader sessionAware mobileMenu onSessionChange={onSessionChange}/><main><section className="compare-results-hero"><Link href={`/compare-properties${codes.length?`?${new URLSearchParams({codes:codes.join(",")})}`:""}`} aria-label="Back to Compare Saved Properties">‹ <span>Back</span></Link><h1>Compare Saved Properties</h1></section>
    {customer===undefined||customer&&codes.length>=2&&items===null&&!error?<div className="compare-results-state" role="status">Loading comparison…</div>:error?<div className="compare-results-state" role="alert"><strong>{error}</strong><Link href="/compare-properties">Back to Compare Saved Properties</Link></div>:unavailable?<div className="compare-results-state"><strong>Enough properties are no longer available to compare.</strong><p>Choose at least two available saved properties.</p><Link href="/compare-properties">Back to Compare Saved Properties</Link></div>:<section className={`comparison-scroll comparison-count-${items!.length}`} tabIndex={items!.length>2?0:undefined} aria-label="Saved property comparison"><div className="comparison-table" style={{"--property-count":items!.length} as React.CSSProperties}><div className="comparison-spacer"/>{items!.map(property=><Header property={property} key={property.code}/>)}{rows.flatMap(([label,value],index)=>{const rowClass=index%2===0?" comparison-row-alt":"";return [<div className={`comparison-label${rowClass}`} key={`${label}-label`}>{label}</div>,...items!.map(property=><div className={`comparison-value${rowClass}`} data-label={label} key={`${label}-${property.code}`}>{value(property)}</div>)]})}</div></section>}
  </main><PublicSiteFooter/></div>}
