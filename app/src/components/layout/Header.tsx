"use client";

import { useState } from "react";

interface HeaderProps {
  userName?: string;
}

export function Header({ userName }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");

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
      <div className="flex items-center justify-between px-10 py-5">
        {/* Search Box */}
        <div className="relative max-w-[420px] flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search clients, cases, employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="
              w-full pl-12 pr-4 py-3
              bg-[var(--bg-surface)] border border-[var(--border-subtle)]
              rounded-xl text-sm text-[var(--text-primary)]
              placeholder:text-[var(--text-muted)]
              focus:outline-none focus:border-[var(--border-accent)]
              focus:ring-[3px] focus:ring-[var(--accent-gold-glow)]
              transition-all duration-200
            "
          />
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-4">
          {/* Date Display */}
          <span className="text-sm text-[var(--text-muted)]">{formatDate()}</span>

          {/* Notification Button */}
          <button className="relative p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-all duration-200">
            <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {/* Notification Dot */}
            <span className="absolute top-2 right-2 w-2 h-2 bg-[var(--danger)] rounded-full animate-pulse-slow" />
          </button>

          {/* Help Button */}
          <button className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-all duration-200">
            <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Page Header */}
      <div className="px-10 pb-6">
        <p className="text-xs font-semibold text-[var(--accent-gold)] uppercase tracking-[2px] mb-2">
          Dashboard Overview
        </p>
        <h2 className="font-display text-[42px] font-medium text-[var(--text-primary)] tracking-tight leading-none">
          {getGreeting()}, {userName || "there"}
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          <span className="text-[var(--accent-gold)]">3</span> upcoming deadlines this week
        </p>
      </div>
    </header>
  );
}
