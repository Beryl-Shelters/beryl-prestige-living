"use client";

import Link from "next/link";
import type { Route } from "next";
import { ChangeEvent, FormEvent, useState } from "react";
import { ChevronDown, Heart, Search, UserRound } from "lucide-react";
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
    if (onSearchSubmit) {
      event.preventDefault();
      onSearchSubmit();
    }
  };

  return <header className="marketplace-header">
    <Link className="marketplace-brand" href="/marketplace" aria-label="Beryl Shelter Marketplace"><BerylShelterLogo /><span className="marketplace-brand-name">Beryl Shelter</span></Link>
    <form className="marketplace-header-search" role="search" action="/marketplace" method="get" onSubmit={submitSearch}>
      <Search aria-hidden="true" size={19} />
      <label className="sr-only" htmlFor="marketplace-search">Search properties</label>
      <input id="marketplace-search" name="q" {...(searchValue === undefined ? { defaultValue: "" } : { value: searchValue, onChange: (event: ChangeEvent<HTMLInputElement>) => onSearchChange?.(event.target.value) })} placeholder={'Try “Lekki” or “Detached House”'} />
    </form>
    <div className="marketplace-header-actions">
      {sessionLoading ? <span className="marketplace-session-status" aria-live="polite">Loading account…</span> : null}
      {!sessionLoading && !authenticated ? <>
        <Link className="marketplace-saved-button" href={loginHrefFor("/saved") as Route}><Heart size={18} aria-hidden="true" /><span>Saved</span></Link>
        <Link href={loginHrefFor(returnTo) as Route}>Log in</Link>
        <Link className="btn btn-primary" href={`/signup?returnTo=${encodeURIComponent(returnTo)}`}>Get started</Link>
      </> : null}
      {authenticated ? <>
        <Link className="marketplace-saved-button" href={"/saved" as Route}><Heart size={18} aria-hidden="true" /><span>Saved</span></Link>
        <button className="marketplace-account-button" type="button" onClick={() => setSwitcherOpen(true)} aria-haspopup="dialog">
          <span className="marketplace-account-avatar"><UserRound size={16} aria-hidden="true" /></span><span>{session?.user.fullName}</span><ChevronDown size={17} aria-hidden="true" />
        </button>
        <button className="marketplace-logout-button" type="button" onClick={() => { void logout(); }}>Log out</button>
      </> : null}
    </div>
    <PersonaSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
  </header>;
}
