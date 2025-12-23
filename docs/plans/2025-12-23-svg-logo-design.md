# Replace Text Logo with SVG

## Summary

Replace the text-based "VEDA Legal / Practice Management" header in the sidebar with the official `Veda Legal.svg` logo.

## Changes

### New file: `app/public/logo.svg`
Copy of `Veda Legal.svg` from project root.

### Modified: `app/src/components/layout/Sidebar.tsx`
Replace lines 107-116 (logo section):

**Before:**
```tsx
<div className="px-5 py-4 border-b border-[var(--border-subtle)]">
  <h1 className="font-heading text-[22px] font-semibold tracking-tight">
    <span className="text-[var(--accent-pink)]">VEDA</span>{" "}
    <span className="text-[var(--text-primary)]">Legal</span>
  </h1>
  <p className="text-[10px] text-[var(--text-muted)] mt-0.5 tracking-wider uppercase">
    Practice Management
  </p>
</div>
```

**After:**
```tsx
<div className="px-5 py-4 border-b border-[var(--border-subtle)]">
  <Image
    src="/logo.svg"
    alt="Veda Legal"
    width={180}
    height={72}
    priority
  />
</div>
```

## Notes

- SVG viewBox is `0 0 83.89 33.7` (2.5:1 aspect ratio)
- 180px width yields ~72px height
- Using Next.js `Image` for consistency and potential optimization
- `priority` flag since logo is above the fold
