import { Suspense } from "react";
import { AdminPropertiesDirectory } from "../../../components/admin-properties-directory";
export default function AdminPropertiesPage(){return <Suspense fallback={<main className="admin-shell-loading">Loading property directory…</main>}><AdminPropertiesDirectory/></Suspense>;}
