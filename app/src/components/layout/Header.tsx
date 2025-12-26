"use client";

import { useState } from "react";
import { useMobileNav } from "@/contexts/MobileNavContext";

interface HeaderProps {
  userName?: string;
}

export function Header({ userName }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { toggle } = useMobileNav();

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Format current date
  const formatDate = () => {
    return new Date().toLocaleDateString("en-GB", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[var(--bg-deep)]/80 border-b border-[var(--border-subtle)]">
      <div className="flex items-center justify-between px-3 py-3 md:px-4 lg:px-6">
        {/* Hamburger - mobile/tablet only */}
        <button
          onClick={toggle}
          className="p-2 -ml-1 mr-2 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors lg:hidden"
          aria-label="Toggle navigation"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Search Box - hidden on phones, visible on tablets+ */}
        <div className="relative max-w-[360px] flex-1 hidden md:block">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search clients, cases, employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="
              w-full pl-9 pr-3 py-2
              bg-[var(--bg-surface)] border border-[var(--border-subtle)]
              rounded text-[13px] text-[var(--text-primary)]
              placeholder:text-[var(--text-muted)]
              focus:outline-none focus:border-[var(--border-accent)]
              focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
              transition-all duration-200
            "
          />
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Date Display - hidden on phones */}
          <span className="text-[13px] text-[var(--text-muted)] hidden md:block">{formatDate()}</span>

          {/* Notification Button */}
          <button className="relative p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-all duration-200">
            <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {/* Notification Dot */}
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[var(--danger)] rounded-full animate-pulse-slow" />
          </button>

          {/* Help Button */}
          <button className="p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-all duration-200">
            <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Page Header */}
      <div className="px-3 pb-3 md:px-4 md:pb-4 lg:px-6">
        <p className="text-[10px] font-semibold text-[var(--accent-pink)] uppercase tracking-[1.5px] mb-1">
          Dashboard Overview
        </p>
        <h2 className="font-heading text-xl md:text-2xl font-medium text-[var(--text-primary)] tracking-tight leading-none">
          {getGreeting()}, {userName || "there"}
        </h2>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1">
          <span className="text-[var(--accent-pink)]">3</span> upcoming deadlines this week
        </p>
      </div>
    </header>
  );
}
