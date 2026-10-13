import type { Metadata } from "next";import { Suspense } from "react";import { AdminReferrersDirectory } from "../../../components/admin-referrers-directory";
export const metadata:Metadata={title:"Referrals | Beryl Shelter Admin"};
export default function Page(){return <Suspense fallback={<main className="admin-directory-loading">Loading referrals…</main>}><AdminReferrersDirectory/></Suspense>;}
