import { redirect } from "next/navigation";

// Preserve existing post-auth destinations while keeping one real Overview.
export default function AccountPage() { redirect("/dashboard"); }
