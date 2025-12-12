"use client";

import { signOut } from "next-auth/react";

// Stat Card Component
interface StatCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  trend?: {
    value: string;
    direction: "up" | "down";
  };
  variant: "clients" | "employees" | "revenue" | "hours";
  delay?: number;
}

function StatCard({ icon, value, label, trend, variant, delay = 0 }: StatCardProps) {
  const variantStyles = {
    clients: "bg-[var(--info-bg)] text-[var(--info)]",
    employees: "bg-[rgba(147,112,219,0.15)] text-[#9370db]",
    revenue: "bg-[var(--success-bg)] text-[var(--success)]",
    hours: "bg-[var(--warning-bg)] text-[var(--accent-gold)]",
  };

  return (
    <div
      className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl p-6
                 hover:border-[var(--border-accent)] hover:-translate-y-1 hover:shadow-xl
                 transition-all duration-300 animate-fade-up"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${variantStyles[variant]}`}>
          {icon}
        </div>
        {trend && (
          <span
            className={`
              flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
              ${trend.direction === "up"
                ? "bg-[var(--success-bg)] text-[var(--success)]"
                : "bg-[var(--danger-bg)] text-[var(--danger)]"
              }
            `}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d={trend.direction === "up" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
              />
            </svg>
            {trend.value}
          </span>
        )}
      </div>
      <div className="font-display text-4xl font-semibold text-[var(--text-primary)] mb-1">
        {value}
      </div>
      <div className="text-sm text-[var(--text-muted)]">{label}</div>
    </div>
  );
}

// Quick Action Button Component
interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

function QuickAction({ icon, label, onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="
        relative p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]
        text-center transition-all duration-200
        hover:border-[var(--border-accent)] hover:-translate-y-0.5
        before:absolute before:inset-0 before:rounded-xl
        before:bg-gradient-to-br before:from-[var(--accent-gold-glow)] before:to-transparent
        before:opacity-0 hover:before:opacity-100 before:transition-opacity
      "
    >
      <div className="relative z-10">
        <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-[var(--bg-hover)] flex items-center justify-center text-[var(--accent-gold)]">
          {icon}
        </div>
        <div className="text-sm font-medium text-[var(--text-primary)]">{label}</div>
      </div>
    </button>
  );
}

export function DashboardContent() {
  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-5">
        <StatCard
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
          value="--"
          label="Active Clients"
          variant="clients"
          delay={0.1}
        />
        <StatCard
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
          value="--"
          label="Team Members"
          variant="employees"
          delay={0.2}
        />
        <StatCard
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          value="--"
          label="This Month Revenue"
          variant="revenue"
          delay={0.3}
        />
        <StatCard
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          value="--"
          label="Billable Hours"
          variant="hours"
          delay={0.4}
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-[1.6fr_1fr] gap-6">
        {/* Recent Activity Placeholder */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden animate-fade-up delay-3">
          <div className="px-7 py-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <h3 className="font-display text-xl font-semibold text-[var(--text-primary)]">
              Recent Clients
            </h3>
            <a href="/clients" className="text-sm text-[var(--accent-gold)] hover:gap-2.5 flex items-center gap-1.5 transition-all">
              View All
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
          <div className="p-7">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-[var(--text-secondary)] mb-1">No clients yet</p>
              <p className="text-sm text-[var(--text-muted)]">Add your first client to get started</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden animate-fade-up delay-4">
          <div className="px-7 py-5 border-b border-[var(--border-subtle)]">
            <h3 className="font-display text-xl font-semibold text-[var(--text-primary)]">
              Quick Actions
            </h3>
          </div>
          <div className="p-7">
            <div className="grid grid-cols-2 gap-4">
              <QuickAction
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4" />
                  </svg>
                }
                label="New Client"
              />
              <QuickAction
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                label="Log Time"
              />
              <QuickAction
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                }
                label="New Case"
              />
              <QuickAction
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
                label="Invoice"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sign Out Button (temporary - for testing) */}
      <div className="flex justify-end">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="
            px-4 py-2 rounded-lg
            bg-[var(--bg-surface)] border border-[var(--border-subtle)]
            text-sm text-[var(--text-secondary)]
            hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]
            transition-all duration-200
          "
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
