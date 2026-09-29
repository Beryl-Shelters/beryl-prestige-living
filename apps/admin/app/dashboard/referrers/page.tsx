import { Suspense } from "react";import { AdminReferrersDirectory } from "../../../components/admin-referrers-directory";
export default function Page(){return <Suspense fallback={<main className="admin-directory-loading">Loading referrers…</main>}><AdminReferrersDirectory/></Suspense>;}
