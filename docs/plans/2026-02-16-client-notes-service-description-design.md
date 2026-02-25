# Client Notes On Service Description Page Design

Date: 2026-02-16

## Context

The billing service description detail page currently shows client name, period, status, summary totals, and editable topic/line-item billing data. Client records already store a `notes` field in the database and clients API, but that field is not currently surfaced in the service description payload used by the page.

Goal: show client notes at the top of the service description page.

## Decisions

1. Display mode: read-only only on this page.
2. Empty state: show a visible placeholder message (`No client notes`) rather than hiding the section.
3. Placement: directly under the existing header (client name / period / status).

## Approaches Considered

### 1. Server-driven notes in existing payload (chosen)

- Extend existing service description query + serialization path to include `client.notes`.
- Update shared type so the detail component receives notes through the current data model.
- Render notes block under the header.

Pros:
- Keeps a single data fetch path.
- No extra client-side network request.
- Consistent source of truth.

Cons:
- Requires small coordinated updates across query, serializer, and type.

### 2. Separate client-side notes fetch

- Keep current service description payload unchanged.
- Fetch client notes independently from the browser.

Pros:
- Fewer server/query changes.

Cons:
- Adds request/loading/error complexity.
- Risks UI inconsistency with the existing page data lifecycle.

### 3. Denormalize notes onto service descriptions

- Copy notes into service description records.

Pros:
- Historical snapshot semantics possible.

Cons:
- Higher schema and synchronization complexity.
- Not required for current goal.

## Proposed Design

## Data Flow

- In `app/src/app/(authenticated)/(admin)/billing/[id]/page.tsx`, include `notes` in the selected client columns.
- In `app/src/lib/billing-utils.ts`, include `client.notes` in `serializeServiceDescription`.
- In `app/src/types/index.ts`, extend `ServiceDescription.client` with `notes: string | null`.

This exposes notes in the same payload already used by `ServiceDescriptionDetail`.

## UI

In `app/src/components/billing/ServiceDescriptionDetail.tsx`:

- Add a `Client Notes` block directly under the existing page header.
- Render actual notes when present.
- Preserve line breaks with `whitespace-pre-wrap`.
- When notes are null/empty/whitespace, show `No client notes`.
- Keep block read-only; no edit controls or API writes from this page.

## Error Handling

- No new runtime error paths are introduced.
- If notes are unavailable/null, the component uses the explicit fallback text.

## Testing Strategy

- Update/add test coverage for serialization/type path to verify `client.notes` is included.
- Update/add component tests for `ServiceDescriptionDetail`:
  - renders notes text when provided
  - renders `No client notes` fallback when null/empty
- Ensure long notes wrap without layout breakage.

## Out of Scope

- Editing notes from service description page.
- Persisting notes snapshots per service description.
- PDF export note rendering changes (unless separately requested).
