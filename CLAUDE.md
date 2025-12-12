# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Veda Legal Timesheets is an admin dashboard interface for a legal firm management system. The codebase consists of static HTML/CSS mockups demonstrating the UI design system.

## File Structure

- `admin-dashboard-mockup.html` - Primary dark theme dashboard (main file)
- `ui/admin-interface.html` - Light theme variant
- `ui/styles.css` - Light theme styles
- `DEVELOPMENT_TEMPLATE.md` - Design system documentation and component patterns

## Design System

### Theme Variants
- **Dark theme** (primary): `admin-dashboard-mockup.html` - Uses embedded styles with CSS variables
- **Light theme**: `ui/` directory - Uses external stylesheet

### Typography
- **Display/Headings**: Cormorant Garamond (serif)
- **Body text**: DM Sans (sans-serif)

### Key CSS Variables (Dark Theme)
```css
--bg-deep: #0f0f0f       /* Page background */
--bg-elevated: #1a1a1a   /* Sidebar, cards */
--bg-surface: #232323    /* Inputs */
--accent-gold: #d4a853   /* Primary accent */
--text-primary: #f5f4f0
--text-secondary: #a8a8a4
```

### Component Patterns
All reusable patterns are documented in `DEVELOPMENT_TEMPLATE.md`:
- Cards, Stat cards, Status badges
- Data tables, Navigation items
- Search inputs, Action buttons
- Employee items, Activity items, Deadline items

## Domain Terminology

- **Client**: External party receiving legal services
- **Employee**: Internal staff (partners, associates, paralegals)
- **Case/Matter**: Legal matter being handled
- **Timesheet**: Record of billable/non-billable hours
- **Billable Hours**: Time chargeable to clients
- **Practice Area**: Legal specialty (Corporate, Family, IP, etc.)

## Development Guidelines

When creating new features:
1. Reference `DEVELOPMENT_TEMPLATE.md` for component patterns and CSS variables
2. Use CSS variables for colors - never hardcode values
3. Add `fadeUp` animation for new sections
4. All interactive elements need hover states
5. Follow BEM-style naming: `.block`, `.block-element`, `.modifier`
