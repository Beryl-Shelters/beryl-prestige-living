import Image from "next/image";
import type { ReactNode } from "react";

import { PublicHeader } from "./public-header";

export function AuthLayout({ children, image = "login" }: { children: ReactNode; image?: "login" | "register" }) {
  return (
    <div className="auth-page">
      <PublicHeader sessionAware mobileMenu />
      <main className={`auth-main${image === "register" ? " auth-main-register" : ""}`}>
        <section className="auth-form-column" aria-label="Account access">
          {children}
        </section>
        <aside className="auth-image-column" aria-label="Beryl Shelter property">
          <Image
            alt="Modern Beryl Shelter property"
            className="auth-image"
            fill
            priority
            sizes="(max-width: 700px) 100vw, 55vw"
            src={image === "register" ? "/auth/register-image.jpg" : "/auth/login-image.jpg"}
          />
        </aside>
      </main>
    </div>
  );
}
