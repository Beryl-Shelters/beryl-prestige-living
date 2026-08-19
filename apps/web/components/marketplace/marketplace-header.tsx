"use client";

import Link from "next/link";
import type { Route } from "next";
import { FormEvent, useState } from "react";
import { Menu, Search, UserRound } from "lucide-react";
import { BerylShelterLogo } from "@/components/brand/beryl-shelter-logo";
import { PersonaSwitcher } from "@/components/persona/persona-switcher";
import { useAuth } from "@/context/auth-provider";
import { loginHrefFor } from "@/lib/return-to";

type MarketplaceHeaderProps = {
  returnTo: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: () => void;
};

export function MarketplaceHeader({ returnTo, searchValue, onSearchChange, onSearchSubmit }: MarketplaceHeaderProps) {
  const { session, sessionLoading, logout } = useAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const authenticated = Boolean(session);
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearchSubmit?.();
  };

  return <header className="marketplace-header">
    <Link href="/marketplace" aria-label="Beryl Shelter Marketplace"><BerylShelterLogo /></Link>
    {searchValue !== undefined ? <form className="marketplace-header-search" role="search" onSubmit={submitSearch}>
      <Search aria-hidden="true" size={19} />
      <label className="sr-only" htmlFor="marketplace-search">Search properties</label>
      <input id="marketplace-search" value={searchValue} onChange={(event) => onSearchChange?.(event.target.value)} placeholder="Search by location, property type or keyword" />
      <button type="submit" aria-label="Search properties"><Search size={18} /></button>
    </form> : <nav className="marketplace-header-nav" aria-label="Marketplace navigation"><Link href="/marketplace">Marketplace</Link></nav>}
    <div className="marketplace-header-actions">
      {sessionLoading ? <span className="marketplace-session-status" aria-live="polite">Loading account…</span> : null}
      {!sessionLoading && !authenticated ? <>
        <Link href={loginHrefFor(returnTo) as Route}>Log in</Link>
        <Link className="btn btn-primary" href={`/signup?returnTo=${encodeURIComponent(returnTo)}`}>Get started</Link>
      </> : null}
      {authenticated ? <>
        <button className="marketplace-account-button" type="button" onClick={() => setSwitcherOpen(true)} aria-haspopup="dialog">
          <UserRound size={17} aria-hidden="true" /><span>{session?.user.fullName}</span><Menu size={16} aria-hidden="true" />
        </button>
        <button className="marketplace-logout-button" type="button" onClick={() => { void logout(); }}>Log out</button>
      </> : null}
    </div>
    <PersonaSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
  </header>;
}
