import type { Metadata } from "next";import { AdminReferrerDetail } from "../../../../components/admin-referrer-detail";
export const metadata:Metadata={title:"Referral Details | Beryl Shelter Admin"};
export default async function Page({params}:{params:Promise<{referrerId:string}>}){return <AdminReferrerDetail id={(await params).referrerId}/>;}
