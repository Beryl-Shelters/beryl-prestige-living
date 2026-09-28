import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import "./admin-app.css";

export const metadata: Metadata = {
  title: "Beryl Shelter Admin",
  description: "Beryl Shelter Admin Portal",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
