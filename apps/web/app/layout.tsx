import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Beryl Shelter", template: "%s | Beryl Shelter" },
  description: "Customer authentication and onboarding for Beryl Shelter Nigeria Limited.",
  applicationName: "Beryl Shelter",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/favicon.ico" },
      { url: "/brand/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/brand/favicon-32x32.png", type: "image/png", sizes: "32x32" }
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", type: "image/png", sizes: "180x180" }]
  },
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={jakarta.className}><Providers>{children}</Providers></body></html>;
}
