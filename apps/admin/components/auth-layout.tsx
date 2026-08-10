import { BrandLogo } from "./brand-logo";
export function AuthLayout({
  children,
  title = "Built for careful administration.",
  artwork = "signup",
}: {
  children: React.ReactNode;
  title?: string;
  artwork?: "signup" | "login";
}) {
  return (
    <main className="auth-layout" aria-label={title}>
      <aside
        className="art-panel"
        data-artwork={artwork}
        aria-label="Beryl Shelter Admin Portal"
      >
        <div className="art-copy">
          <span className="art-badge">Admin Portal</span>
          <h2>Manage listings, leads and your team.</h2>
          <p>Secure access for Beryl Shelter Nigeria Limited staff.</p>
          <span className="art-note">Invitation-only access</span>
        </div>
      </aside>
      <section className="form-panel">
        <header className="auth-header">
          <BrandLogo />
          <a href="https://berylshelter.com">Keep browsing homes <span aria-hidden>×</span></a>
        </header>
        <div className="form-content">
          {children}
        </div>
      </section>
    </main>
  );
}
