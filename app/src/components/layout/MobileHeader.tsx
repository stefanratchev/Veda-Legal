"use client";

import { useMobileNav } from "@/contexts/MobileNavContext";

export function MobileHeader() {
  const { toggle } = useMobileNav();

  return (
    <header className="sticky top-0 z-40 px-3 py-3 bg-[var(--bg-deep)] border-b border-[var(--border-subtle)] lg:hidden">
      <button
        onClick={toggle}
        className="p-2 -ml-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
        aria-label="Open navigation menu"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
    </header>
  );
}
