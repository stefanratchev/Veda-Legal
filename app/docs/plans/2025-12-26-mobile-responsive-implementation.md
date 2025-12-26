# Mobile Responsive Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the app work on phones (< 768px) and tablets (768-1023px) while keeping desktop (>= 1024px) unchanged.

**Architecture:** Add responsive Tailwind classes that default to mobile layout, using `lg:` prefix to preserve current desktop styles. Sidebar becomes a hamburger-triggered overlay on mobile. Forms stack vertically. Tables become cards.

**Tech Stack:** Tailwind CSS v4, React state for sidebar toggle, existing component patterns.

---

## Task 1: Create Mobile Navigation Context

**Files:**
- Create: `src/contexts/MobileNavContext.tsx`

**Step 1: Create the context file**

```tsx
"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface MobileNavContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const MobileNavContext = createContext<MobileNavContextType | null>(null);

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <MobileNavContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  const context = useContext(MobileNavContext);
  if (!context) {
    throw new Error("useMobileNav must be used within MobileNavProvider");
  }
  return context;
}
```

**Step 2: Verify file was created correctly**

Run: `ls -la src/contexts/`
Expected: File exists

**Step 3: Commit**

```bash
git add src/contexts/MobileNavContext.tsx
git commit -m "feat: add MobileNavContext for sidebar toggle state"
```

---

## Task 2: Update Authenticated Layout with MobileNavProvider

**Files:**
- Modify: `src/app/(authenticated)/layout.tsx`

**Step 1: Wrap layout in MobileNavProvider and remove fixed margin on mobile**

Update the layout to:
1. Import and wrap with MobileNavProvider
2. Remove `ml-[240px]` on mobile (keep on `lg:`)
3. Adjust padding for mobile

```tsx
import { getCurrentUser } from "@/lib/user";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNavProvider } from "@/contexts/MobileNavContext";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <MobileNavProvider>
      <div className="flex min-h-screen">
        <Sidebar
          user={{
            name: user.name,
            position: user.position,
            initials: user.initials,
            image: user.image,
          }}
          className="animate-slide-in"
        />
        <main className="flex-1 lg:ml-[240px]">
          <div className="px-3 py-4 md:px-4 lg:px-6 lg:py-5">{children}</div>
        </main>
      </div>
    </MobileNavProvider>
  );
}
```

**Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add src/app/\(authenticated\)/layout.tsx
git commit -m "feat: wrap layout in MobileNavProvider, responsive margins"
```

---

## Task 3: Add Hamburger Button to Header

**Files:**
- Modify: `src/components/layout/Header.tsx`

**Step 1: Add hamburger icon and import useMobileNav**

The header needs:
1. Import useMobileNav hook
2. Add hamburger button (visible only on mobile/tablet)
3. Hide search on small phones, show on tablets+

```tsx
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
```

**Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: add hamburger button to header, responsive search/date"
```

---

## Task 4: Make Sidebar Responsive with Overlay Mode

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Update Sidebar to support overlay mode on mobile**

Key changes:
1. Import useMobileNav hook
2. Add overlay backdrop (visible when open on mobile)
3. Position sidebar off-screen on mobile, slide in when open
4. Close sidebar when nav item clicked (on mobile)
5. Desktop (lg:) stays exactly the same

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useMobileNav } from "@/contexts/MobileNavContext";

// ... keep existing interfaces and Icons/navSections constants unchanged ...

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

  // Close sidebar when clicking outside on mobile
  useClickOutside(sidebarRef, () => {
    if (isOpen) close();
  }, isOpen);

  // Close sidebar on route change (mobile)
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
      {/* Backdrop - mobile only */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={close}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`
          fixed left-0 top-0 h-screen w-[240px]
          bg-[var(--bg-elevated)] border-r border-[var(--border-subtle)]
          flex flex-col z-50
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:transition-none
          ${className || ""}
        `}
      >
        {/* Logo */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
          <Image
            src="/logo.svg"
            alt="Veda Legal"
            width={180}
            height={72}
            priority
          />
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

        {/* User Profile Footer - unchanged */}
        {user && (
          <div className="p-3 border-t border-[var(--border-subtle)]" ref={userMenuRef}>
            {/* ... existing user menu code ... */}
          </div>
        )}
      </aside>
    </>
  );
}
```

**Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: make sidebar overlay on mobile with backdrop"
```

---

## Task 5: Make WeekStrip Scrollable on Mobile

**Files:**
- Modify: `src/components/timesheets/WeekStrip.tsx`

**Step 1: Add horizontal scroll wrapper for days on mobile**

Key changes:
1. Wrap the days container in a scrollable div on mobile
2. Keep arrows visible at edges
3. Desktop remains unchanged

Update the days section (around line 115-150):

```tsx
{/* Days - scrollable on mobile */}
<div className="flex-1 overflow-x-auto lg:overflow-visible scrollbar-hide">
  <div className="flex items-center gap-1 min-w-max lg:min-w-0">
    {weekDays.map((day) => {
      // ... existing day rendering code unchanged ...
    })}
  </div>
</div>
```

Also add scrollbar-hide utility to globals.css if not present:

```css
/* Hide scrollbar for horizontal scroll on mobile */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

**Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add src/components/timesheets/WeekStrip.tsx src/app/globals.css
git commit -m "feat: make WeekStrip horizontally scrollable on mobile"
```

---

## Task 6: Make EntryForm Stack Vertically on Mobile

**Files:**
- Modify: `src/components/timesheets/EntryForm.tsx`

**Step 1: Update form layout to stack on mobile**

Key changes:
1. Change flex row to flex col on mobile, row on lg
2. Make inputs full width on mobile
3. Duration + buttons share row on mobile

```tsx
return (
  <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-3 lg:p-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      {/* Client Selector */}
      <ClientSelect
        clients={clients}
        value={formData.clientId}
        onChange={(clientId) => {
          onFormChange({ clientId });
          setTimeout(() => topicSelectRef.current?.open(), 0);
        }}
        placeholder="Select client..."
        className="w-full lg:w-[160px] lg:flex-shrink-0"
      />

      {/* Topic/Subtopic Cascade Selector */}
      <TopicCascadeSelect
        ref={topicSelectRef}
        topics={topics}
        value={formData.subtopicId}
        onChange={handleSubtopicSelect}
        placeholder="Select topic..."
        className="w-full lg:w-[160px] lg:flex-shrink-0"
      />

      {/* Duration + Actions Row (mobile) / inline (desktop) */}
      <div className="flex items-center gap-2 lg:contents">
        <DurationPicker
          ref={durationPickerRef}
          hours={formData.hours}
          minutes={formData.minutes}
          onChange={(hours, minutes) => {
            onFormChange({ hours, minutes });
            setTimeout(() => descriptionInputRef.current?.focus(), 0);
          }}
          className="w-[100px] flex-shrink-0"
        />

        {/* Action Buttons - visible on mobile in this row */}
        <div className="flex items-center gap-2 lg:hidden ml-auto">
          {isEditMode && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="
                px-3 py-2 rounded flex-shrink-0
                text-[var(--text-secondary)] text-sm
                bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                hover:border-[var(--border-accent)]
                transition-colors
              "
            >
              Cancel
            </button>
          )}
          <button
            onClick={onSubmit}
            disabled={!canSubmit || isLoading}
            className="
              px-4 py-2 rounded flex-shrink-0
              bg-[var(--accent-pink)] text-[var(--bg-deep)]
              font-semibold text-sm
              hover:bg-[var(--accent-pink-dim)]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
              shadow-lg shadow-[var(--accent-pink-glow)]
            "
          >
            {isLoading ? "..." : isEditMode ? "Save" : "Log"}
          </button>
        </div>
      </div>

      {/* Description - full width on mobile */}
      <input
        ref={descriptionInputRef}
        type="text"
        value={formData.description}
        onChange={handleDescriptionChange}
        onKeyDown={handleKeyDown}
        placeholder="What did you work on?"
        className={`
          w-full lg:flex-1 lg:min-w-[200px] px-3 py-2 rounded text-sm
          bg-[var(--bg-surface)] border border-[var(--border-subtle)]
          text-[var(--text-primary)] placeholder-[var(--text-muted)]
          focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
          focus:outline-none transition-all duration-200
          ${highlightDescription ? "ring-[2px] ring-[var(--accent-pink-glow)] border-[var(--border-accent)]" : ""}
        `}
      />

      {/* Action Buttons - desktop only (inline) */}
      <div className="hidden lg:flex items-center gap-2">
        {isEditMode && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="
              px-3 py-2 rounded flex-shrink-0
              text-[var(--text-secondary)] text-sm
              bg-[var(--bg-surface)] border border-[var(--border-subtle)]
              hover:border-[var(--border-accent)]
              transition-colors
            "
          >
            Cancel
          </button>
        )}
        <button
          onClick={onSubmit}
          disabled={!canSubmit || isLoading}
          className="
            px-4 py-2 rounded flex-shrink-0
            bg-[var(--accent-pink)] text-[var(--bg-deep)]
            font-semibold text-sm
            hover:bg-[var(--accent-pink-dim)]
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
            shadow-lg shadow-[var(--accent-pink-glow)]
          "
        >
          {isLoading ? "..." : isEditMode ? "Save" : "Log"}
        </button>
      </div>
    </div>

    {/* Error Message - unchanged */}
    {error && (
      <div className="mt-2 px-3 py-2 rounded bg-[var(--danger-bg)] text-[var(--danger)] text-[13px]">
        {error}
      </div>
    )}
  </div>
);
```

**Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add src/components/timesheets/EntryForm.tsx
git commit -m "feat: make EntryForm stack vertically on mobile"
```

---

## Task 7: Create EntryCard Component for Mobile

**Files:**
- Create: `src/components/timesheets/EntryCard.tsx`

**Step 1: Create card component for mobile entry display**

```tsx
"use client";

import { formatHours } from "@/lib/date-utils";
import type { TimeEntry } from "@/types";

interface EntryCardProps {
  entry: TimeEntry;
  onEditClick?: () => void;
  onDeleteClick?: () => void;
  readOnly?: boolean;
}

export function EntryCard({ entry, onEditClick, onDeleteClick, readOnly = false }: EntryCardProps) {
  return (
    <div className="bg-[var(--bg-surface)] rounded-lg p-3">
      {/* Header: Client + Hours */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">
          {entry.client.name}
        </span>
        <span className="text-[15px] font-semibold text-[var(--accent-pink)] whitespace-nowrap">
          {formatHours(entry.hours)}
        </span>
      </div>

      {/* Topic */}
      {entry.topicName && (
        <p className="text-[12px] text-[var(--text-muted)] mb-1 truncate">
          {entry.topicName}
          {entry.subtopicName && ` › ${entry.subtopicName}`}
        </p>
      )}

      {/* Description */}
      <p className="text-[13px] text-[var(--text-secondary)] line-clamp-2">
        {entry.description}
      </p>

      {/* Actions */}
      {!readOnly && (
        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-[var(--border-subtle)]">
          {entry.isLocked ? (
            <span className="text-[11px] text-[var(--text-muted)] italic">Billed</span>
          ) : (
            <>
              <button
                onClick={onEditClick}
                className="px-2.5 py-1 rounded text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-pink)] hover:bg-[var(--accent-pink-glow)] transition-colors"
              >
                Edit
              </button>
              <button
                onClick={onDeleteClick}
                className="px-2.5 py-1 rounded text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify file was created correctly**

Run: `ls -la src/components/timesheets/EntryCard.tsx`
Expected: File exists

**Step 3: Commit**

```bash
git add src/components/timesheets/EntryCard.tsx
git commit -m "feat: add EntryCard component for mobile entries display"
```

---

## Task 8: Update EntriesList to Use Cards on Mobile

**Files:**
- Modify: `src/components/timesheets/EntriesList.tsx`

**Step 1: Import EntryCard and render cards on mobile, table on desktop**

Key changes:
1. Import EntryCard
2. Render card list on mobile (hidden on lg)
3. Render table on desktop (hidden below lg)

```tsx
"use client";

import { useMemo, useState } from "react";
import { formatHours } from "@/lib/date-utils";
import { EntryRow } from "./EntryRow";
import { EntryCard } from "./EntryCard";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { TimeEntry, Client, Topic } from "@/types";

// ... keep existing interface ...

export function EntriesList({
  entries,
  isLoadingEntries,
  onDeleteEntry,
  onUpdateEntry,
  readOnly = false,
  clients = [],
  topics = [],
}: EntriesListProps) {
  const [entryToDelete, setEntryToDelete] = useState<TimeEntry | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const dailyTotal = useMemo(() => {
    return entries.reduce((sum, entry) => sum + entry.hours, 0);
  }, [entries]);

  const handleConfirmDelete = () => {
    if (entryToDelete && onDeleteEntry) {
      onDeleteEntry(entryToDelete.id);
      setEntryToDelete(null);
    }
  };

  // Loading state
  if (isLoadingEntries) {
    return (
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded overflow-hidden">
        <div className="flex items-center justify-center py-8">
          <svg className="w-6 h-6 animate-spin text-[var(--accent-pink)]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      </div>
    );
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded overflow-hidden">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded bg-[var(--bg-surface)] flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-[var(--text-secondary)] text-sm">No entries for this date</p>
          <p className="text-[13px] text-[var(--text-muted)] mt-0.5">Use the form above to log your time</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded overflow-hidden">
      {/* Mobile: Cards */}
      <div className="lg:hidden p-3 space-y-2">
        {entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            onEditClick={readOnly || entry.isLocked ? undefined : () => setEditingEntryId(entry.id)}
            onDeleteClick={readOnly ? undefined : () => setEntryToDelete(entry)}
            readOnly={readOnly}
          />
        ))}
        {/* Daily Total */}
        <div className="pt-2 text-center border-t border-[var(--border-subtle)]">
          <span className="text-[13px] font-medium text-[var(--text-secondary)]">Daily Total: </span>
          <span className="text-base text-[var(--accent-pink)]">{formatHours(dailyTotal)}</span>
        </div>
      </div>

      {/* Desktop: Table */}
      <div className="hidden lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <th className="w-[150px] px-4 py-2 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                Client
              </th>
              <th className="w-[180px] px-4 py-2 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                Topic
              </th>
              <th className="w-[70px] px-4 py-2 text-right text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                Hours
              </th>
              <th className="px-4 py-2 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
                Work
              </th>
              {!readOnly && (
                <th className="w-[50px] px-4 py-2"></th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                onDeleteClick={readOnly ? undefined : () => setEntryToDelete(entry)}
                onUpdate={onUpdateEntry}
                readOnly={readOnly}
                clients={clients}
                topics={topics}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--bg-surface)]">
              <td colSpan={readOnly ? 4 : 5} className="px-4 py-3 text-center">
                <span className="text-[13px] font-medium text-[var(--text-secondary)]">Daily Total: </span>
                <span className="text-base text-[var(--accent-pink)]">{formatHours(dailyTotal)}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {!readOnly && entryToDelete && (
        <ConfirmModal
          title="Delete Entry"
          message={`Are you sure you want to delete this ${formatHours(entryToDelete.hours)} entry for ${entryToDelete.client.name}? This action cannot be undone.`}
          confirmLabel="Delete"
          isDestructive
          onConfirm={handleConfirmDelete}
          onCancel={() => setEntryToDelete(null)}
        />
      )}
    </div>
  );
}
```

**Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add src/components/timesheets/EntriesList.tsx
git commit -m "feat: show entry cards on mobile, table on desktop"
```

---

## Task 9: Make UI Dropdowns Touch-Friendly

**Files:**
- Modify: `src/components/ui/ClientSelect.tsx`
- Modify: `src/components/ui/TopicCascadeSelect.tsx`
- Modify: `src/components/ui/DurationPicker.tsx`

**Step 1: Add larger touch targets and responsive width**

For each component, ensure:
1. Minimum height of 44px for touch targets
2. Dropdown items have adequate padding
3. Component accepts className for responsive width

Check and update if needed - likely just need to ensure py-2.5 or similar padding on clickable items.

**Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add src/components/ui/
git commit -m "feat: ensure touch-friendly sizing on UI dropdowns"
```

---

## Task 10: Update Modals for Mobile

**Files:**
- Modify: `src/components/ui/ConfirmModal.tsx`

**Step 1: Make modals more mobile-friendly**

Update modal container to use tighter margins on mobile:

```tsx
// Change from mx-4 to mx-2 on mobile, mx-4 on larger screens
<div className="bg-[var(--bg-elevated)] rounded-lg p-4 md:p-6 mx-2 md:mx-4 max-w-md w-full ...">
```

**Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add src/components/ui/ConfirmModal.tsx
git commit -m "feat: tighter modal margins on mobile"
```

---

## Task 11: Test and Verify All Breakpoints

**Step 1: Run the dev server**

Run: `npm run dev`

**Step 2: Test at key widths**

Open Chrome DevTools responsive mode and test:
- 375px (iPhone) - sidebar hidden, hamburger visible, form stacked, cards shown
- 768px (iPad portrait) - sidebar hidden, search visible, form stacked, cards shown
- 1024px (iPad landscape) - sidebar visible, desktop layout
- 1440px (desktop) - should be identical to current

**Step 3: Run full build to verify no errors**

Run: `npm run build`
Expected: Build completes without errors

**Step 4: Run tests**

Run: `npm run test -- --run`
Expected: All tests pass

---

## Task 12: Final Commit and Summary

**Step 1: Verify git status is clean**

Run: `git status`
Expected: Nothing to commit, working tree clean

**Step 2: If any uncommitted changes, commit them**

```bash
git add -A
git commit -m "chore: final mobile responsive polish"
```

**Step 3: Push branch**

```bash
git push -u origin feature/mobile-responsive
```

---

## Summary of Changes

| Component | Change |
|-----------|--------|
| `MobileNavContext` | New context for sidebar toggle state |
| `layout.tsx` | Wrapped in provider, responsive margins |
| `Header.tsx` | Hamburger button, responsive search/date |
| `Sidebar.tsx` | Overlay mode on mobile, backdrop, close on nav |
| `WeekStrip.tsx` | Horizontally scrollable on mobile |
| `EntryForm.tsx` | Stacked layout on mobile |
| `EntryCard.tsx` | New card component for mobile entries |
| `EntriesList.tsx` | Cards on mobile, table on desktop |
| UI components | Touch-friendly sizing |
| `ConfirmModal.tsx` | Tighter mobile margins |
