import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Beryl Shelter", template: "%s | Beryl Shelter" },
  description: "Customer authentication and onboarding for Beryl Shelter Nigeria Limited.",
  applicationName: "Beryl Shelter",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={jakarta.className}><Providers>{children}</Providers></body></html>;
}
