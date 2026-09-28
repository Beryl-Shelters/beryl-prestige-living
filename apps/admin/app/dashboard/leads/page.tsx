import { Suspense } from "react";

import { AdminLeadsBoard } from "../../../components/admin-leads-board";

export default function AdminLeadsPage() {
  return <Suspense fallback={<main className="admin-shell-loading">Loading leads…</main>}><AdminLeadsBoard/></Suspense>;
}
