import Image from "next/image";
import Link from "next/link";
export function BrandLogo({ href = "/login", dark = false }: { href?: "/login" | "/dashboard"; dark?: boolean }) { return <Link className="brand-lockup" data-dark={dark || undefined} href={href}><Image className="brand-logo" src="/brand/android-chrome-192x192.png" alt="" width={42} height={42} priority /><span>Beryl Shelter</span></Link>; }
