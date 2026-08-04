import Image from "next/image";

export function BerylShelterLogo({ className = "" }: { className?: string }) {
  return <div className={`brand-lockup ${className}`.trim()}><Image className="brand-logo-mark" src="/brand/android-chrome-192x192.png" alt="" width={48} height={48} priority /><span className="brand-wordmark">Beryl Shelter</span></div>;
}
