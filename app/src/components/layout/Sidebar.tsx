"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useMobileNav } from "@/contexts/MobileNavContext";

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
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
  topics: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
};

const navSections: NavSection[] = [
  {
    label: "CLIENTS & MATTERS",
    items: [
      { name: "Clients", href: "/clients", icon: Icons.clients, adminOnly: true },
      { name: "Topics", href: "/topics", icon: Icons.topics, adminOnly: true },
    ],
  },
  {
    label: "TIME RECORDING",
    items: [
      { name: "Timesheets", href: "/timesheets", icon: Icons.timesheets },
    ],
  },
  {
    label: "FINANCIALS",
    items: [
      { name: "Billing", href: "/billing", icon: Icons.billing, adminOnly: true },
      { name: "Reports", href: "/reports", icon: Icons.reports, adminOnly: true },
    ],
  },
  {
    label: "PRACTICE",
    items: [
      { name: "Team", href: "/team", icon: Icons.employees },
    ],
  },
];

// Format position for display (SENIOR_ASSOCIATE → "Senior Associate")
function formatPosition(position: string): string {
  return position
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

// Check if position has admin-level access
function hasAdminAccess(position: string): boolean {
  return ["ADMIN", "PARTNER"].includes(position);
}

interface SidebarProps {
  user?: {
    name: string;
    position: string;
    initials: string;
    image?: string | null;
  };
  className?: string;
}

export function Sidebar({ user, className }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = user?.position ? hasAdminAccess(user.position) : false;
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const { isOpen, close } = useMobileNav();

  useClickOutside(userMenuRef, () => setShowUserMenu(false), showUserMenu);
  useClickOutside(sidebarRef, () => {
    if (isOpen) close();
  }, isOpen);

  // Close sidebar on route change
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

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
    <>
      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={close}
        />
      )}
      <aside
        ref={sidebarRef}
        className={`
          fixed left-0 top-0 h-screen w-full lg:w-[220px]
          bg-[var(--bg-elevated)] lg:border-r border-[var(--border-subtle)]
          flex flex-col z-50
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:transition-none
          ${className || ""}
        `}
      >
      {/* Header with Logo and Close button */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
        <Image
          src="/logo.svg"
          alt="Veda Legal"
          width={180}
          height={72}
          priority
        />
        {/* Close button - mobile only */}
        <button
          onClick={close}
          className="p-2 -mr-2 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors lg:hidden"
          aria-label="Close navigation menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navSections.map((section, sectionIndex) => {
          const visibleItems = section.items.filter((item) => !item.adminOnly || isAdmin);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label} className={sectionIndex === 0 ? "" : "pt-4"}>
              <p className="px-3 pb-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                {section.label}
              </p>
              <div className="space-y-1">
                {visibleItems.map((item) => (
                  <NavItemComponent key={item.name} item={item} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User Profile Footer */}
      {user && (
        <div className="p-3 border-t border-[var(--border-subtle)]" ref={userMenuRef}>
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              {user.image ? (
                /* eslint-disable-next-line @next/next/no-img-element -- base64 data URL doesn't benefit from next/image optimization */
                <img
                  src={user.image}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent-pink)] to-[var(--accent-pink-dim)] flex items-center justify-center text-[var(--bg-deep)] font-heading font-semibold text-xs">
                  {user.initials}
                </div>
              )}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[13px] font-medium text-[var(--text-primary)] truncate leading-tight">
                  {user.name}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] leading-tight">{formatPosition(user.position)}</p>
              </div>
              <svg
                className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${showUserMenu ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg shadow-lg overflow-hidden animate-fade-up">
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
          {/* Version indicator - admin only */}
          {isAdmin && (
            <p className="text-[9px] text-[var(--text-muted)] text-center mt-2 opacity-50">
              {process.env.NEXT_PUBLIC_BUILD_ID}
            </p>
          )}
        </div>
      )}
      </aside>
    </>
  );
}
