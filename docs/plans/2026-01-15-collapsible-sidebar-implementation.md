# Collapsible Sidebar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the sidebar collapsible via a draggable resize handle with snap behavior and localStorage persistence.

**Architecture:** Add resize handle to sidebar right edge. Drag interaction updates width in real-time, snaps to collapsed (56px) or expanded (220px) on release. State persists in localStorage. Collapsed state shows icons only with tooltips.

**Tech Stack:** React useState/useEffect, DOM mouse events, localStorage, Tailwind CSS

---

## Task 1: Create Logo Icon SVG

**Files:**
- Create: `app/public/logo-icon.svg`

**Step 1: Extract octopus from logo.svg**

Create `app/public/logo-icon.svg` with the octopus path extracted from the full logo:

```svg
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 34">
  <defs>
    <linearGradient id="octopus-gradient" x1="13.71" y1="0" x2="13.71" y2="33.7" gradientUnits="userSpaceOnUse">
      <stop offset=".34" stop-color="#f99"/>
      <stop offset="1" stop-color="#f09"/>
    </linearGradient>
  </defs>
  <path fill="url(#octopus-gradient)" d="M25.71,26.3c-.55-.12-1.62,0-2.09-.32,.59-.14,2.03-.78,2.32-2.5,.07-.59-.17-2.21-2.01-2.5-.26-.04-1.05,.09-1.22,.75-.12,.5,.51,1.05,.92,.74-2.39,2.87-5.2,1.58-5.45,.86,.88-1.69,2.06-3.06,3.23-6.53,.59-1.97,.87-4.22,.66-6.8C21.38,3.99,14.65,.24,8.6,.01,5.15-.12,1.88,.81,.44,3.98c-2.57,7.14,6.94,10.38,9.24,12.16,2.68,2.03,4.07,3.34,4.62,4.84,.32,.85,.28,2.02,.25,2.43,0,0-.02,.02-.03,.03-.96,.18-3.47,.78-6.07-1.27,.55,.15,1.24,.11,1.49-.39,.22-1.05-.64-1.47-1.38-1.61-.92-.16-2.31,.51-2.43,1.98-.16,2,1.96,2.76,2.82,3.13-1.16,.29-3.07,.7-3.61,1.78-.19,.38-.52,1.23,.79,1.23,.96,.07,2.84-1.12,4.15,.03-.91,.4-3.34,1.05-2.84,2.34,.61,1.57,5.8,.36,7.38-.96,0,.91-1.36,3.24-.25,3.95,.98,.56,2.78-2.91,3.41-4.21,.84,.58,1.74,1.8,2.64,2.26,.91,.47,2.05,.71,2.58-.07,.38-.58,.15-1.06-.25-1.59-.41-.54-.98-.91-1.26-1.51,1.38,.13,5.17,.44,5.66-.55,.48-1.13-1.29-1.61-1.63-1.68h0Zm-6.63-13.14s1.09-1.39,1.23-1.24c.28,0,.63,.45,.7,.7,.28,.84,.41,1.7-.71,2.53-1.41,.97-1.69,.36-1.7,.32-.32-1.14,.47-2.3,.47-2.3h0Zm-2.8,2.93c-.4,.17-1.03,.18-1.74,.07-.76-.12-1.26-.41-1.68-.92-.43-.6-.66-1.31-.7-2.05-.11-.9,.29-1.6,.79-1.38l1.87,.84c.22,.11,1.2,.64,1.97,2.82,.05,.12-.09,.42-.53,.61h0Z"/>
</svg>
```

**Step 2: Verify the icon renders**

Open `http://localhost:3000/logo-icon.svg` in browser to verify the octopus displays correctly.

**Step 3: Commit**

```bash
git add app/public/logo-icon.svg
git commit -m "feat: add octopus-only logo icon for collapsed sidebar"
```

---

## Task 2: Add Collapse State and localStorage Hook

**Files:**
- Modify: `app/src/components/layout/Sidebar.tsx`

**Step 1: Add collapse state with localStorage initialization**

Add after the existing `useState` declarations (around line 112):

```tsx
// Collapsed state - persisted to localStorage
const [isCollapsed, setIsCollapsed] = useState(false);

// Initialize from localStorage on mount (client-side only)
useEffect(() => {
  const stored = localStorage.getItem('sidebarCollapsed');
  if (stored === 'true') {
    setIsCollapsed(true);
  }
}, []);

// Persist to localStorage when changed
useEffect(() => {
  localStorage.setItem('sidebarCollapsed', String(isCollapsed));
}, [isCollapsed]);
```

**Step 2: Verify no hydration errors**

Run: `npm run dev` and check browser console for hydration mismatch errors.
Expected: No errors (we initialize to `false` and update client-side only).

**Step 3: Commit**

```bash
git add app/src/components/layout/Sidebar.tsx
git commit -m "feat: add collapse state with localStorage persistence"
```

---

## Task 3: Add Resize Handle with Drag Logic

**Files:**
- Modify: `app/src/components/layout/Sidebar.tsx`

**Step 1: Add drag state**

Add after the `isCollapsed` state:

```tsx
// Drag resize state
const [isDragging, setIsDragging] = useState(false);
const [dragWidth, setDragWidth] = useState<number | null>(null);
```

**Step 2: Add drag handlers**

Add before the `return` statement:

```tsx
// Resize handle drag logic
const handleMouseDown = (e: React.MouseEvent) => {
  e.preventDefault();
  setIsDragging(true);
  setDragWidth(isCollapsed ? 56 : 220);
};

useEffect(() => {
  if (!isDragging) return;

  const handleMouseMove = (e: MouseEvent) => {
    // Clamp between 40px and 300px during drag
    const newWidth = Math.max(40, Math.min(300, e.clientX));
    setDragWidth(newWidth);
  };

  const handleMouseUp = (e: MouseEvent) => {
    setIsDragging(false);
    setDragWidth(null);

    // Snap to collapsed if < 140px, otherwise expanded
    const finalWidth = e.clientX;
    const shouldCollapse = finalWidth < 140;
    setIsCollapsed(shouldCollapse);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  return () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}, [isDragging]);
```

**Step 3: Add resize handle element**

Inside the `<aside>` element, add as the last child (before `</aside>`):

```tsx
{/* Resize handle - desktop only */}
<div
  onMouseDown={handleMouseDown}
  className={`
    hidden lg:block absolute right-0 top-0 bottom-0 w-2 cursor-col-resize
    hover:bg-white/10 transition-colors
    ${isDragging ? 'bg-white/10' : ''}
  `}
/>
```

**Step 4: Update aside width styling**

Update the `<aside>` className to use dynamic width:

Replace the width classes `w-full lg:w-[220px]` with:

```tsx
style={isDragging && dragWidth !== null ? { width: dragWidth } : undefined}
className={`
  fixed left-0 top-0 h-screen
  ${isDragging ? 'w-auto' : isCollapsed ? 'w-full lg:w-[56px]' : 'w-full lg:w-[220px]'}
  bg-[var(--bg-elevated)] lg:border-r border-[var(--border-subtle)]
  flex flex-col z-50
  transition-transform duration-300 ease-in-out
  ${!isDragging ? 'lg:transition-[width] lg:duration-200' : ''}
  ${isOpen ? 'translate-x-0' : '-translate-x-full'}
  lg:translate-x-0
  ${className || ''}
`}
```

**Step 5: Test drag behavior**

Run dev server, drag sidebar edge:
- Should follow mouse during drag
- Should snap to 56px or 220px on release
- Should persist after page reload

**Step 6: Commit**

```bash
git add app/src/components/layout/Sidebar.tsx
git commit -m "feat: add resize handle with drag-to-snap behavior"
```

---

## Task 4: Update Header for Collapsed State

**Files:**
- Modify: `app/src/components/layout/Sidebar.tsx`

**Step 1: Import logo-icon**

The Image component already handles this. Update the header section.

**Step 2: Update header to switch logos**

Replace the header `<div>` (the one with the logo) with:

```tsx
{/* Header with Logo and Close button */}
<div className={`
  flex items-center border-b border-[var(--border-subtle)]
  ${isCollapsed ? 'justify-center px-2 py-4' : 'justify-between px-5 py-4'}
`}>
  {isCollapsed ? (
    <Image
      src="/logo-icon.svg"
      alt="Veda Legal"
      width={32}
      height={32}
      priority
      className="hidden lg:block"
    />
  ) : null}
  <Image
    src="/logo.svg"
    alt="Veda Legal"
    width={180}
    height={72}
    priority
    className={isCollapsed ? 'lg:hidden' : ''}
  />
  {/* Close button - mobile only */}
  <button
    onClick={close}
    className={`
      p-2 -mr-2 rounded text-[var(--text-secondary)]
      hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]
      transition-colors lg:hidden
      ${isCollapsed ? 'mr-0' : '-mr-2'}
    `}
    aria-label="Close navigation menu"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>
</div>
```

**Step 3: Verify logo switching**

- Expanded: Full logo visible
- Collapsed: Octopus icon only (on desktop)
- Mobile: Always full logo (collapse doesn't apply)

**Step 4: Commit**

```bash
git add app/src/components/layout/Sidebar.tsx
git commit -m "feat: switch to octopus icon in collapsed header"
```

---

## Task 5: Update Navigation for Collapsed State

**Files:**
- Modify: `app/src/components/layout/Sidebar.tsx`

**Step 1: Add tooltip state to NavItemComponent**

Replace the `NavItemComponent` with:

```tsx
const NavItemComponent = ({ item }: { item: NavItem }) => {
  const isActive = pathname === item.href;
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <Link
        href={item.href}
        onMouseEnter={() => isCollapsed && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          relative flex items-center gap-2.5 rounded
          text-[13px] font-medium transition-all duration-200
          ${isCollapsed ? 'px-0 py-2 justify-center' : 'px-3 py-2'}
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
        <span className={`flex-shrink-0 ${isActive ? "text-[var(--accent-pink)]" : ""}`}>
          {item.icon}
        </span>
        {!isCollapsed && <span className="truncate">{item.name}</span>}
      </Link>

      {/* Tooltip - collapsed state only */}
      {showTooltip && isCollapsed && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 pointer-events-none">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-2 py-1 text-[12px] text-[var(--text-primary)] whitespace-nowrap shadow-lg">
            {item.name}
          </div>
        </div>
      )}
    </div>
  );
};
```

**Step 2: Hide section labels when collapsed**

Update the section label `<p>` element:

```tsx
{!isCollapsed && (
  <p className="px-3 pb-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
    {section.label}
  </p>
)}
```

**Step 3: Verify navigation**

- Expanded: Icons + text, section labels visible
- Collapsed: Icons only, centered, tooltips on hover
- Clicking icons still navigates

**Step 4: Commit**

```bash
git add app/src/components/layout/Sidebar.tsx
git commit -m "feat: icon-only nav with tooltips in collapsed state"
```

---

## Task 6: Update User Profile Footer for Collapsed State

**Files:**
- Modify: `app/src/components/layout/Sidebar.tsx`

**Step 1: Update user profile section**

Replace the user profile footer section with:

```tsx
{/* User Profile Footer */}
{user && (
  <div className={`p-3 border-t border-[var(--border-subtle)] ${isCollapsed ? 'flex justify-center' : ''}`} ref={userMenuRef}>
    <div className="relative">
      <button
        onClick={() => setShowUserMenu(!showUserMenu)}
        className={`
          flex items-center rounded hover:bg-[var(--bg-hover)] transition-colors cursor-pointer
          ${isCollapsed ? 'p-1 justify-center' : 'w-full gap-2.5 px-2 py-2'}
        `}
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
        {!isCollapsed && (
          <>
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
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {showUserMenu && (
        <div className={`
          absolute mb-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg shadow-lg overflow-hidden animate-fade-up
          ${isCollapsed ? 'bottom-full left-full ml-1' : 'bottom-full left-0 right-0'}
        `}>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
    {/* Version indicator - admin only, hidden when collapsed */}
    {isAdmin && !isCollapsed && (
      <p className="text-[9px] text-[var(--text-muted)] text-center mt-2 opacity-50">
        {process.env.NEXT_PUBLIC_BUILD_ID}
      </p>
    )}
  </div>
)}
```

**Step 2: Verify user profile**

- Expanded: Full profile with name, position, chevron
- Collapsed: Avatar only, centered
- Dropdown opens to the right when collapsed

**Step 3: Commit**

```bash
git add app/src/components/layout/Sidebar.tsx
git commit -m "feat: avatar-only user profile in collapsed state"
```

---

## Task 7: Final Polish and Testing

**Files:**
- Modify: `app/src/components/layout/Sidebar.tsx` (if needed)

**Step 1: Manual testing checklist**

Test each scenario:

- [ ] Drag from expanded → release at < 140px → snaps to collapsed
- [ ] Drag from collapsed → release at >= 140px → snaps to expanded
- [ ] Collapsed state persists after page reload
- [ ] Expanded state persists after page reload
- [ ] Tooltips appear on hover in collapsed state
- [ ] Navigation works in collapsed state
- [ ] User dropdown works in collapsed state
- [ ] Mobile: collapse feature hidden, slide-in works normally
- [ ] Resize handle cursor changes on hover
- [ ] Smooth transition animation on snap

**Step 2: Fix any issues found**

Address any visual or functional issues discovered during testing.

**Step 3: Run lint and type check**

```bash
cd app && npm run lint && npx tsc --noEmit
```

Expected: No errors

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete collapsible sidebar implementation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create logo icon SVG | `app/public/logo-icon.svg` |
| 2 | Add collapse state + localStorage | `Sidebar.tsx` |
| 3 | Add resize handle with drag logic | `Sidebar.tsx` |
| 4 | Update header for collapsed state | `Sidebar.tsx` |
| 5 | Update navigation with tooltips | `Sidebar.tsx` |
| 6 | Update user profile footer | `Sidebar.tsx` |
| 7 | Final polish and testing | `Sidebar.tsx` |
