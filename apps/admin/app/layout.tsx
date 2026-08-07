import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
export const metadata: Metadata = { title: { default: "Admin Portal | Beryl Shelter", template: "%s | Beryl Shelter" }, description: "Beryl Shelter Nigeria Limited Admin Portal.", robots: { index: false, follow: false }, icons: { icon: [{ url: "/brand/favicon.ico" }] } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body className={jakarta.className}><Providers>{children}</Providers></body></html>; }
