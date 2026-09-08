import Image from "next/image";

export function BrandLogo({ size = 42 }: { size?: number }) {
  return (
    <span className="brand-lockup">
      <Image src="/brand/beryl-shelter-logo.png" alt="Beryl Shelter" width={size} height={size} className="brand-logo" priority />
      <span className="brand-name" aria-hidden="true">Beryl Shelter</span>
    </span>
  );
}
