"use client";

import { useId } from "react";

/**
 * Saleh — brand mark.
 *
 * A crafted monogram: a single continuous "S" stroke drawn as a signal path
 * (software × networks), rendered in the active theme's accent gradient and
 * finished with a live "prompt" node — the same dot that punctuates the
 * `saleh.im` wordmark and the terminal cursor motif across the site.
 *
 * Fully theme-aware (colors come from CSS custom properties) and self-scaling.
 * `useId` keeps the gradient definitions unique when several marks share a page.
 */
export function Logo({
  size = 36,
  className = "",
  animated = true,
}: {
  size?: number;
  className?: string;
  animated?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const stroke = `ls-${uid}`;
  const frame = `lf-${uid}`;
  const glow = `lg-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`${animated ? "logo-mark" : ""} ${className}`}
      role="img"
      aria-label="Saleh"
      fill="none"
    >
      <defs>
        <linearGradient id={stroke} x1="20" y1="12" x2="80" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--accent)" }} />
          <stop offset="1" style={{ stopColor: "var(--accent-2)" }} />
        </linearGradient>
        <linearGradient id={frame} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--line-2)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--line)" }} />
          <stop offset="1" style={{ stopColor: "var(--line-2)" }} />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" style={{ stopColor: "var(--accent)", stopOpacity: 0.35 }} />
          <stop offset="1" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
        </radialGradient>
      </defs>

      {/* chip */}
      <rect x="3" y="3" width="94" height="94" rx="27" style={{ fill: "var(--bg-3)" }} />
      <rect x="3" y="3" width="94" height="94" rx="27" fill={`url(#${frame})`} stroke={`url(#${frame})`} strokeWidth="2.5" fillOpacity="0" />
      {/* soft inner glow */}
      <rect x="3" y="3" width="94" height="94" rx="27" fill={`url(#${glow})`} />

      {/* the S signal path */}
      <path
        d="M67 33.5 C67 24.5 59.5 20.5 49.5 20.5 C38 20.5 32 26.5 32 35.5 C32 51 67 45 67 61 C67 71 59 77.5 47.5 77.5 C37.5 77.5 30 73.5 28.5 65.5"
        stroke={`url(#${stroke})`}
        strokeWidth="11"
        strokeLinecap="round"
      />

      {/* live prompt node */}
      <circle cx="73.5" cy="72.5" r="6.5" style={{ fill: "var(--accent)" }} />
    </svg>
  );
}
