# Line Item Waive Inline Actions Design

## Context
The service description page currently uses a small icon-triggered dropdown for line-item waive actions ("Exclude from billing" and "Include at $0"). In dense table layouts this menu can clip under container boundaries and requires an extra click.

## Goals
- Remove dropdown clipping and stacking issues.
- Reduce interaction from two clicks to one click.
- Keep waiver states clear at row level.

## Chosen Approach
Use inline per-row action buttons in the actions cell:
- `Exclude`
- `$0`

State mapping:
- `waiveMode = null`: both actions inactive.
- `waiveMode = "EXCLUDED"`: `Exclude` active.
- `waiveMode = "ZERO"`: `$0` active.

Interaction:
- Clicking an inactive action applies that waive mode.
- Clicking the active action restores normal billing (`waiveMode = null`).
- Existing delete behavior remains unchanged.
- Existing row visuals for excluded/zero rows remain unchanged.

## Accessibility
- Keep native `<button>` controls.
- Add `aria-pressed` on each toggle button to expose selected state.
- Use explicit `title` labels for hover assist.

## Non-Goals
- No API/data model changes.
- No changes to totals logic or PDF behavior.
