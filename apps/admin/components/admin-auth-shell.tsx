import Image from "next/image";
import type { ReactNode } from "react";

type AdminAuthShellProps = {
  children: ReactNode;
  variant: "login" | "invitation";
};

function ShieldIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 3 5.5 5.6v5.2c0 4.2 2.7 8 6.5 9.3 3.8-1.3 6.5-5.1 6.5-9.3V5.6L12 3Z" />
      <path d="m9.2 11.8 1.8 1.8 3.8-4" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9a2.4 2.4 0 1 1 3.6 2.1c-.9.5-1.4 1-1.4 2.1M12 16.8h.01" />
    </svg>
  );
}

export function AdminAuthShell({ children, variant }: AdminAuthShellProps) {
  const homesUrl = process.env.NEXT_PUBLIC_WEB_APP_URL ?? "http://localhost:3000";
  const background =
    variant === "login"
      ? "/auth/admin-login.png"
      : "/auth/admin-invitation.png";

  return (
    <main className={`admin-auth-shell admin-auth-shell--${variant}`}>
      <section className="admin-auth-visual" aria-label="Beryl Admin Portal">
        <Image
          alt=""
          className="admin-auth-background"
          fill
          priority
          sizes="(max-width: 900px) 100vw, 50vw"
          src={background}
          unoptimized
        />
        <div className="admin-auth-shade" />
        <div className="admin-auth-intro">
          <div className="admin-portal-pill">
            <ShieldIcon />
            <span>Admin Portal</span>
          </div>
          <h2>Manage listings, leads and your team.</h2>
          <p>Secure access for Beryl Prestige Living staff.</p>
          <div className="admin-invitation-note">
            <HelpIcon />
            <span>Invitation-only access</span>
          </div>
        </div>
      </section>

      <section className="admin-auth-workspace">
        <header className="admin-auth-header">
          <Image
            alt="Beryl Shelter"
            className="admin-auth-logo"
            height={48}
            priority
            src="/brand/beryl-shelter-logo.png"
            unoptimized
            width={48}
          />
          <a aria-label="Keep browsing homes" className="browse-homes-link" href={homesUrl}>
            <span>Keep browsing homes</span>
            <span aria-hidden="true" className="browse-homes-close">×</span>
          </a>
        </header>
        <div className="admin-auth-content">{children}</div>
      </section>
    </main>
  );
}
