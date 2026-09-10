"use client";
import {useCallback,useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {AuthApiError} from "../../lib/auth-api";
import {listingsRequest} from "../../lib/listings-api";
import {showAuthError} from "../auth/toast-provider";
export function useListingError() {
  const router=useRouter();
  return useCallback((error:unknown)=>{if(error instanceof AuthApiError && error.status===401) router.replace("/login");else showAuthError(error);},[router]);
}
export function useListingRequest<T>(path:string) {
  const [data,setData]=useState<T|null>(null);const [loading,setLoading]=useState(true);const [attempt,setAttempt]=useState(0);const error=useListingError();
  useEffect(()=>{const controller=new AbortController();void listingsRequest<T>(path,{signal:controller.signal}).then(value=>{if(!controller.signal.aborted){setData(value);setLoading(false);}}).catch(failure=>{if(!controller.signal.aborted){setLoading(false);error(failure);}});return()=>controller.abort();},[path,attempt,error]);
  return {data,loading,setData,reload:()=>{setLoading(true);setAttempt(value=>value+1);}};
}
