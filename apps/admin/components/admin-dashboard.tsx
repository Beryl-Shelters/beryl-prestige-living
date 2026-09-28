"use client";
import { useCallback,useState } from "react";
import { AdminAppShell,useAdminAccount } from "./admin-app-shell";
import { InviteAdminDialog } from "./invite-admin-dialog";

function DashboardContent(){const admin=useAdminAccount(),[open,setOpen]=useState(false);const close=useCallback(()=>setOpen(false),[]);return <main className="admin-dashboard-page"><header className="admin-page-heading"><span className="eyebrow">Beryl Shelter</span><h1>Admin Portal</h1><p>Manage Beryl Shelter operations from one secure workspace.</p></header><section className="admin-card"><div><h2>Admin management</h2><p>Invite approved administrators with secure, expiring setup links.</p></div>{admin.role==="SUPER_ADMIN"&&<button onClick={()=>setOpen(true)}>Invite Admin</button>}</section><InviteAdminDialog open={open} onClose={close}/></main>;}

export function AdminDashboard(){return <AdminAppShell><DashboardContent/></AdminAppShell>;}
