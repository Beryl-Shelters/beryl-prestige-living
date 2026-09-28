import { Suspense } from "react";

import { AdminUsersDirectory } from "../../../components/admin-users-directory";

export default function AdminUsersPage() {
  return <Suspense fallback={<main className="admin-shell-loading">Loading customer directory…</main>}><AdminUsersDirectory/></Suspense>;
}
