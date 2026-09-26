import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";

import { ToastProvider } from "../components/auth/toast-provider";
import "./globals.css";
import "./floating-help.css";

const jakarta = localFont({
  src: "./fonts/plus-jakarta-sans-latin.woff2",
  weight: "200 800",
  style: "normal",
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Beryl Shelter",
  description: "Beryl Shelter",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={jakarta.variable}>
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
