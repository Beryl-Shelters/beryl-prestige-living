import { apiClient } from "./api-client";

export async function downloadAndOpenMandate(listingId:string,reference:string){const response=await apiClient.download(`/api/v1/listings/${encodeURIComponent(listingId)}/physical-mandate/pdf`),bytes=new Uint8Array(response.byteLength);bytes.set(response);const blob=new Blob([bytes.buffer],{type:"application/pdf"}),url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download=`Beryl-Shelter-Sales-Mandate-${reference}.pdf`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return url;}
