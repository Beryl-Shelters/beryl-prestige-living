import type { ReactNode } from "react";

const paths: Record<string, ReactNode> = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  listings: <><path d="m8 8 6-5 7 6v11H8Z" /><path d="M5 18H3V8l7-5" /></>,
  analytics: <><path d="M11 3a9 9 0 1 0 10 10H11Z" /><path d="M15 3v6h6a9 9 0 0 0-6-6Z" /></>,
  messages: <><path d="M3 4h18v14H8l-5 3Z" /><path d="M7 10h.01M12 10h.01M17 10h.01" strokeWidth="3" /></>,
  properties: <path d="m2 11 10-8 10 8M5 9v12h14V9M10 21v-7h4v7" />,
  referrals: <><circle cx="7" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M3 13v-2a4 4 0 0 1 8 0M14 11V5m0 0-3 3m3-3 3 3M10 15v6m0 0 3-3m-3 3-3-3M14 16a4 4 0 0 1 8 0" /></>,
  settings: <><path d="m10 2-1 3-3 1-3-1-2 4 2 2v3l-2 2 2 4 3-1 3 1 1 3h4l1-3 3-1 3 1 2-4-2-2v-3l2-2-2-4-3 1-3-1-1-3Z" transform="translate(1 0) scale(.9)" /><circle cx="12" cy="11" r="3" /></>,
  logout: <path d="M10 3H4v18h6M10 12h11m-4-4 4 4-4 4" />,
  home: <path d="m11 4-8 8 8 8M3 12h18" />,
  investments: <><path d="M3 16h4l4-3h5a2 2 0 0 1 0 4h-4m-5 0 6 4 8-5M3 14v7" /><circle cx="13" cy="6" r="3" /><path d="M13 3v6" /></>,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  close: <path d="m5 5 14 14M19 5 5 19" />,
};
export function DashboardIcon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
