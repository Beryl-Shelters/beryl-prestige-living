"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { PublicHeader } from "../auth/public-header";
import type { Customer } from "../../lib/auth-api";
import { PublicSiteFooter } from "./public-site-footer";

const sellDestination = "/dashboard/listings/new";

export function PublicSellPage() {
  const router = useRouter();
  const [session, setSession] = useState<"checking" | "guest" | "signed-in">("checking");

  const onSessionChange = useCallback(
    (value: Customer | null) => {
      if (value) {
        setSession("signed-in");
        router.replace(sellDestination);
      } else {
        setSession("guest");
      }
    },
    [router]
  );

  return (
    <div className="public-page public-sell-page">
      <PublicHeader sessionAware mobileMenu onSessionChange={onSessionChange} />
      {session === "guest" && (
        <main className="public-sell-main">
          <div className="public-sell-container">
            <div className="public-sell-card">
              <div className="public-sell-icon-wrapper" aria-hidden="true">
                <svg
                  className="public-sell-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <h1 className="public-sell-title">Sign in to list a property</h1>
              <p className="public-sell-body">
                Please log in to your account to list a property and track your listings. If you don&apos;t have an account yet, you can easily create one to get started
              </p>
              <div className="public-sell-actions">
                <Link
                  href={`/register?next=${encodeURIComponent(sellDestination)}`}
                  className="button button-primary public-sell-btn-primary"
                >
                  Create free account
                </Link>
                <Link
                  href={`/login?next=${encodeURIComponent(sellDestination)}`}
                  className="button button-secondary public-sell-btn-secondary"
                >
                  Log In
                </Link>
              </div>
            </div>
          </div>
        </main>
      )}
      {session === "guest" && <PublicSiteFooter />}
    </div>
  );
}
