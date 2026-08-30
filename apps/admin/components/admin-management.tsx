"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MailPlus, Plus, X } from "lucide-react";
import { errorMessage, postApi } from "@/lib/client-api";
import { FieldError } from "./form-controls";
import { trackAdminEvent } from "@/lib/analytics/admin";

type Staff = { id: string; fullName: string; email: string; phone: string | null; department: "TECH" | "MANAGEMENT"; adminRole: "ADMIN" | "SUPER_ADMIN"; status: "PENDING" | "ACTIVE" | "SUSPENDED" | "LOCKED"; createdAt: string };
const schema = z.object({ fullName: z.string().trim().min(2, "Enter the Admin's full name"), email: z.string().trim().email("Enter a valid email"), phone: z.string().trim().optional(), department: z.enum(["TECH", "MANAGEMENT"]), adminRole: z.enum(["ADMIN", "SUPER_ADMIN"]) }); type Values = z.infer<typeof schema>;

const fetchStaff = async (): Promise<Staff[]> => {
  const response = await fetch("/api/admin/staff", { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? "Unable to load Admin staff.");
  return payload.data ?? [];
};

export function AdminManagement() {
  const [staff, setStaff] = useState<Staff[]>([]); const [loading, setLoading] = useState(true); const [open, setOpen] = useState(false); const [message, setMessage] = useState(""); const [resending, setResending] = useState<string | null>(null); const dialogRef = useRef<HTMLElement>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { department: "MANAGEMENT", adminRole: "ADMIN" } });
  const load = async () => { try { setStaff(await fetchStaff()); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load Admin staff."); } finally { setLoading(false); } };
  useEffect(() => {
    let active = true;
    void fetchStaff()
      .then((data) => { if (active) setStaff(data); })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Unable to load Admin staff."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!open) return;
    void trackAdminEvent("Invite Admin Form Viewed", {});
  }, [open]);
  useEffect(() => { if (!open) return; const dialog = dialogRef.current; const first = dialog?.querySelector<HTMLElement>("button, input, select"); first?.focus(); const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); if (event.key !== "Tab" || !dialog) return; const controls = Array.from(dialog.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled)")); if (!controls.length) return; const firstControl = controls[0]; const lastControl = controls[controls.length - 1]; if (event.shiftKey && document.activeElement === firstControl) { event.preventDefault(); lastControl.focus(); } else if (!event.shiftKey && document.activeElement === lastControl) { event.preventDefault(); firstControl.focus(); } }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [open]);
  const invite = async (values: Values) => { setMessage(""); try { await postApi("/api/admin/invite", values); setMessage(`Invitation sent to ${values.email}.`); setOpen(false); reset(); await load(); } catch (error) { setMessage(errorMessage(error, "Unable to send this invitation.")); } };
  const resend = async (id: string) => { setResending(id); setMessage(""); try { await postApi(`/api/admin/staff/${id}/resend-invitation`, {}); setMessage("Invitation resent successfully."); await load(); } catch (error) { setMessage(errorMessage(error, "Unable to resend this invitation.")); } finally { setResending(null); } };
  return <section className="admin-management"><div className="management-header"><div><p className="eyebrow">Admin Portal</p><h1>Admin Management</h1><p>Manage who can access the Beryl Shelter Admin Portal.</p></div><button className="button button-primary" type="button" onClick={() => setOpen(true)}><Plus size={16} /> Invite Admin</button></div>{message ? <p className={message.startsWith("Invitation sent") || message.startsWith("Invitation resent") ? "alert alert-success" : "alert alert-error"} role="status">{message}</p> : null}<div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>Full Name</th><th>Email</th><th>Department</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{loading ? <tr><td colSpan={7}>Loading Admin staff…</td></tr> : staff.map((member) => <tr key={member.id}><td>{member.fullName}</td><td>{member.email}</td><td>{member.department}</td><td>{member.adminRole.replace("_", " ")}</td><td><span className={`status-badge status-${member.status.toLowerCase()}`}>{member.status}</span></td><td><time dateTime={member.createdAt}>{new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(member.createdAt))}</time></td><td>{member.status === "PENDING" ? <button className="table-action" type="button" disabled={resending === member.id} onClick={() => resend(member.id)}><MailPlus size={15} /> {resending === member.id ? "Resending…" : "Resend"}</button> : "—"}</td></tr>)}</tbody></table></div>{open ? <div className="dialog-backdrop" role="presentation"><section className="invite-dialog" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="invite-admin-heading"><header><div><p className="eyebrow">Admin Portal</p><h2 id="invite-admin-heading">Invite Admin</h2></div><button className="icon-btn" type="button" onClick={() => setOpen(false)} aria-label="Close invitation form"><X /></button></header><p>Send a secure invitation to a new Admin.</p><form className="form-stack" onSubmit={handleSubmit(invite)} noValidate><div className="field-wrap"><label className="field-label" htmlFor="fullName">Full name</label><input className="form-control" id="fullName" {...register("fullName")} /><FieldError>{errors.fullName?.message}</FieldError></div><div className="field-wrap"><label className="field-label" htmlFor="invite-email">Email address</label><input className="form-control" id="invite-email" type="email" autoComplete="email" {...register("email")} /><FieldError>{errors.email?.message}</FieldError></div><div className="field-wrap"><label className="field-label" htmlFor="phone">Phone number <span aria-hidden>(optional)</span></label><input className="form-control" id="phone" type="tel" autoComplete="tel" {...register("phone")} /><FieldError>{errors.phone?.message}</FieldError></div><div className="field-wrap"><label className="field-label" htmlFor="department">Department</label><select id="department" className="form-control" {...register("department")}><option value="TECH">TECH</option><option value="MANAGEMENT">MANAGEMENT</option></select></div><div className="field-wrap"><label className="field-label" htmlFor="adminRole">Role</label><select id="adminRole" className="form-control" {...register("adminRole")}><option value="ADMIN">ADMIN</option><option value="SUPER_ADMIN">SUPER ADMIN</option></select></div><button className="button button-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? "Sending invitation…" : "Send invitation"}</button></form></section></div> : null}</section>;
}
