import Link from "next/link";
import { BrandLogo } from "./brand-logo";

const navigation = [
  ["Home", "/"],
  ["About", "/about"],
  ["Referrals", "/referrals"],
  ["Buy", "/buy"],
  ["Sell / List a Property", "/sell"],
  ["Analytics & Insights", "/analytics"],
  ["Careers", "/careers"],
  ["Support", "/support"],
] as const;

export function PublicHeader() {
  return (
    <header className="public-header">
      <Link className="brand" href="/" aria-label="Beryl Shelter home">
        <BrandLogo />
      </Link>
      <nav className="public-nav" aria-label="Public navigation">
        {navigation.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}
      </nav>
      <div className="header-actions">
        <Link className="button button-outline header-button" href="/login">Login</Link>
        <Link className="button button-primary header-button" href="/register">Register</Link>
      </div>
    </header>
  );
}
