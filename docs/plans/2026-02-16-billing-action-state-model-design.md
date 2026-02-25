# Billing Action State Model Design

## Context
The current line-item actions on the service description page evolved from a trash/remove model plus waive modes. This created unclear semantics and inconsistent expectations around whether items should disappear from the table.

The desired UX is a single clear action that asks what billing outcome should apply, while keeping line items visible in the service description for traceability.

## Goals
- Replace multiple row-level actions with one clear action entry point.
- Keep all affected rows visible in the service description (no disappearing rows for state changes).
- Ensure invoice PDF behavior is explicit and consistent.
- Preserve quick reversibility back to regular billing.

## Final Interaction Model
Each line item has one action button:
- `Billing action`

Clicking it opens a modal with billing outcome choices:
1. `Bill later`
2. `Mark as billed`
3. `Waive (show at €0)`
4. `Regular billing` (reset/default)

`Regular billing` is included to make state reversal explicit without adding additional row controls.

## Row State Semantics
- **Regular billing**
  - Default state.
  - Included in current invoice totals.
  - Shown in generated PDF.

- **Bill later**
  - Row remains visible in service description with status badge `Bill later`.
  - Excluded from current invoice totals.
  - Hidden from generated PDF.

- **Mark as billed**
  - Row remains visible in service description with status badge `Marked as billed`.
  - Excluded from current invoice totals.
  - Hidden from generated PDF.

- **Waive (show at €0)**
  - Row remains visible with status badge `Waived`.
  - Included in PDF with zero monetary effect.
  - Counts as €0 in totals.

## Data Model Direction
Use a single mutually exclusive line-item billing state (existing `waiveMode` can be extended or replaced by a clearer enum).

Logical states required by UI/behavior:
- `REGULAR`
- `BILL_LATER`
- `MARK_BILLED`
- `WAIVE_ZERO`

Exactly one state applies at a time.

## PDF/Calculation Rules
- Include in PDF: `REGULAR`, `WAIVE_ZERO`
- Exclude from PDF: `BILL_LATER`, `MARK_BILLED`
- Include in billed totals: `REGULAR`
- Include as €0: `WAIVE_ZERO`
- Exclude from billed totals: `BILL_LATER`, `MARK_BILLED`

## UX Copy
- Row action: `Billing action`
- Modal title: `Set billing action`
- Option labels:
  - `Bill later`
  - `Mark as billed`
  - `Waive (show at €0)`
  - `Regular billing`
- Row badges:
  - `Bill later`
  - `Marked as billed`
  - `Waived`

## Non-Goals
- No changes to topic-level pricing, discounts, or cap logic.
- No changes to drag-and-drop ordering behavior.
- No immediate analytics/schema redesign beyond required status representation.
