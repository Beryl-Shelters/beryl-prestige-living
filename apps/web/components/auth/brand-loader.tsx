import { BrandLogo } from "./brand-logo";

export function BrandLoader({ fullPage = false }: { fullPage?: boolean }) {
  return (
    <div className={`brand-loader${fullPage ? " brand-loader-page" : ""}`} role="status" aria-label="Loading" aria-busy="true">
      <BrandLogo size={64} />
    </div>
  );
}
