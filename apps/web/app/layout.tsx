import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ToastProvider } from "../components/auth/toast-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beryl Shelter",
  description: "Beryl Shelter",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
