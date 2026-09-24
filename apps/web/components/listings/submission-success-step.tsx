"use client";

import Link from "next/link";
import type { Listing } from "../../lib/listings-api";

function formatSubmissionTimestamp(dateStr?: string | null): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = d.getDate();
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;
  return `${day} ${month} ${year}, ${hours}:${minutes}${ampm}`;
}

export function SubmissionSuccessStep({ listing }: { listing?: Listing | null | undefined }) {
  const timestamp = formatSubmissionTimestamp(listing?.requested_at || listing?.updated_at);

  return (
    <div className="submit-success-container">
      <div className="submit-success-content">
        <div className="submit-success-illustration-wrapper" aria-hidden="true">
          <svg
            className="submit-success-house-svg"
            viewBox="0 0 140 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Ground line */}
            <path d="M10 110 H130" stroke="#d1d5db" strokeWidth="2.5" strokeLinecap="round" />
            {/* House body */}
            <rect x="35" y="52" width="70" height="58" rx="2" fill="#e2d6c3" stroke="#8b7355" strokeWidth="2.5" />
            {/* Gabled roof */}
            <path d="M28 54 L70 20 L112 54 Z" fill="#8f6b2e" stroke="#6e5223" strokeWidth="2.5" strokeLinejoin="round" />
            {/* Chimney */}
            <rect x="88" y="24" width="12" height="20" fill="#a07834" stroke="#6e5223" strokeWidth="2" />
            {/* Door */}
            <path d="M60 110 V80 C60 76 64 74 70 74 C76 74 80 76 80 80 V110 Z" fill="#5c441c" />
            {/* Left window */}
            <rect x="44" y="66" width="14" height="14" rx="2" fill="#ffffff" stroke="#8b7355" strokeWidth="1.5" />
            <line x1="51" y1="66" x2="51" y2="80" stroke="#8b7355" strokeWidth="1" />
            <line x1="44" y1="73" x2="58" y2="73" stroke="#8b7355" strokeWidth="1" />
            {/* Right window */}
            <rect x="82" y="66" width="14" height="14" rx="2" fill="#ffffff" stroke="#8b7355" strokeWidth="1.5" />
            <line x1="89" y1="66" x2="89" y2="80" stroke="#8b7355" strokeWidth="1" />
            <line x1="82" y1="73" x2="96" y2="73" stroke="#8b7355" strokeWidth="1" />

            {/* Checkmark circle badge at top right */}
            <g transform="translate(100, 10)">
              <circle cx="16" cy="16" r="15" fill="#16a34a" />
              <path
                d="M10 16.5 L14.5 21 L22 12"
                stroke="#ffffff"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        </div>

        <h1 className="submit-success-title">Your listing has been submitted to our team</h1>
        <p className="submit-success-subtitle">
          We&apos;ll check the details and let you know within 2 working days. Thank you for listing
          with Beryl
        </p>

        <div className="submit-success-timeline-card">
          <h2 className="timeline-card-title">What Happens Next?</h2>
          <ol className="submit-timeline-list">
            <li className="submit-timeline-item completed">
              <span className="timeline-badge-check" aria-hidden="true">
                ✓
              </span>
              <div className="timeline-text">
                <strong className="timeline-heading">Submitted</strong>
                <span className="timeline-timestamp">{timestamp}</span>
              </div>
            </li>

            <li className="submit-timeline-item active">
              <span className="timeline-badge-dot" aria-hidden="true" />
              <div className="timeline-text">
                <strong className="timeline-heading">We review your listing</strong>
                <p className="timeline-body">
                  We check your details and documents. If anything needs changing, we&apos;ll tell you
                  exactly what.
                </p>
              </div>
            </li>

            <li className="submit-timeline-item pending">
              <span className="timeline-badge-dot hollow" aria-hidden="true" />
              <div className="timeline-text">
                <strong className="timeline-heading">It goes live</strong>
                <p className="timeline-body">
                  Buyers can now find your listed property and register interest
                </p>
              </div>
            </li>
          </ol>
        </div>

        <div className="submit-success-action">
          <Link href="/dashboard/listings" className="button button-primary submit-success-cta">
            View my listings
          </Link>
        </div>
      </div>
    </div>
  );
}
