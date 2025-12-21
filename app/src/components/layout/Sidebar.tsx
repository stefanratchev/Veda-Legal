"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

// Icons as constants to avoid repetition
const Icons = {
  clients: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  employees: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  timesheets: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  billing: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  reports: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
};

const navItems: NavItem[] = [
  { name: "Clients", href: "/clients", icon: Icons.clients, adminOnly: true },
  { name: "Employees", href: "/employees", icon: Icons.employees },
  { name: "Timesheets", href: "/timesheets", icon: Icons.timesheets },
  { name: "Billing", href: "/billing", icon: Icons.billing, adminOnly: true },
  { name: "Reports", href: "/reports", icon: Icons.reports, adminOnly: true },
];

interface SidebarProps {
  user?: {
    name: string;
    role: string;
    initials: string;
  };
  className?: string;
}

export function Sidebar({ user, className }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = user?.role === "ADMIN";

  // Filter nav items based on role
  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const NavItemComponent = ({ item }: { item: NavItem }) => {
    const isActive = pathname === item.href;

    return (
      <Link
        href={item.href}
        className={`
          relative flex items-center gap-2.5 px-3 py-2 rounded
          text-[13px] font-medium transition-all duration-200
          ${isActive
            ? "text-[var(--text-primary)] bg-gradient-to-r from-[var(--accent-pink-glow)] to-transparent"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          }
          before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2
          before:w-[2px] before:rounded-r-sm before:bg-[var(--accent-pink)]
          before:transition-all before:duration-200
          ${isActive ? "before:h-6" : "before:h-0 hover:before:h-5"}
        `}
      >
        <span className={`flex-shrink-0 ${isActive ? "text-[var(--accent-pink)]" : ""}`}>{item.icon}</span>
        <span className="truncate">{item.name}</span>
      </Link>
    );
  };

  return (
    <aside className={`fixed left-0 top-0 h-screen w-[240px] bg-[var(--bg-elevated)] border-r border-[var(--border-subtle)] flex flex-col ${className || ""}`}>
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
        <h1 className="font-heading text-[22px] font-semibold tracking-tight">
          <span className="text-[var(--accent-pink)]">Veda</span>{" "}
          <span className="text-[var(--text-primary)]">Legal</span>
        </h1>
        <p className="text-[10px] text-[var(--text-muted)] mt-0.5 tracking-wider uppercase">
          Practice Management
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-1">
          {visibleNavItems.map((item) => (
            <NavItemComponent key={item.name} item={item} />
          ))}
        </div>
      </nav>

      {/* User Profile Footer */}
      {user && (
        <div className="p-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent-pink)] to-[var(--accent-pink-dim)] flex items-center justify-center text-[var(--bg-deep)] font-heading font-semibold text-xs">
              {user.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--text-primary)] truncate leading-tight">
                {user.name}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] leading-tight">{user.role}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
