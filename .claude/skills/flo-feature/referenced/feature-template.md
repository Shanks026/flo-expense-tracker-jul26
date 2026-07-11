# Feature Doc Template

Use this exact structure when writing a new feature planning doc.
Replace all `[placeholders]` with actual content.

---

```markdown
# Feature: [Feature Name]
**Product**: FLO — Personal Expense Tracker
**File**: `.claude/features/[NN]-[feature-slug].md`
**Status**: Planned
**Last Updated**: [Month Year]

---

## Context

[2–3 sentences explaining why this feature exists and what problem it solves.
Reference the existing pattern it follows if applicable — e.g. "reuses the
month-selector pattern from the Transactions screen".]

---

## Phase Overview

\`\`\`
Phase 1 — [Short name]
  [One sentence description]

Phase 2 — [Short name]
  [One sentence description]

[Add more phases if needed. Typically 1–4 for a FLO feature — this is a
single-user app, most features don't need Tercero-scale phasing.]
\`\`\`

**After each phase: stop and wait for approval before proceeding.**

---

## Phase 1 — [Name]

### Goal
[One paragraph. What does the user get at the end of this phase? What can
they do that they couldn't do before?]

### Before Starting — Confirm With Codebase
[List 3–5 specific things to verify by reading actual files before writing
any code. E.g. existing hook names, route names, column names on a view,
whether a component already exists that this should extend instead.]

### 1.1 Database

[List every new table, column, index, RLS policy, or view needed for this
phase. Include the full SQL in one block, ready to paste into the Supabase
SQL editor. If no DB changes, say "No database changes in this phase."
This block is the durable schema record — see the note on SQL in SKILL.md.]

### 1.2 Data Layer

[Describe new or changed hooks in `hooks/`: name, what it queries/computes,
return shape. Describe where mutations happen (usually inline in a sheet
component) and what they call on success (`notifyChanged()`). If a
computation is genuinely reusable across screens, put it in a plain
function in `lib/` and say why it doesn't belong inline in the hook.]

### 1.3 Components

[List every new component/screen file with its path and purpose. Note
whether it's a route (`app/...`), a sheet (Provider + Context + forwardRef
pattern), or a plain reusable component. Describe props and key UI
elements. Include a file tree if it's more than 2-3 files.]

### 1.4 Navigation / Integration

[Describe changes to existing screens — new route, new entry in the menu
sheet, new tab, new button on an existing screen that opens this. Be
specific about file names and where the entry point is added.]

### 1.5 Impact on Existing Features

[Table of any existing screens/hooks/views affected, what changes, and
what to watch for. Say "None" if genuinely isolated.]

### 1.6 What This Phase Does NOT Include

[Explicit list of things out of scope for this phase specifically.]

### 1.7 Phase 1 Checklist — Before Marking Complete

[Every item that must be true for this phase to be considered done.
Written as verifiable statements, not tasks.]

- [ ] [Specific, verifiable item]
- [ ] [Specific, verifiable item]
- [ ] [...]

**→ Stop here. Show the result and wait for approval.**

---

## Phase 2 — [Name]

### Goal
[...]

### Before Starting — Confirm Phase 1 is Approved

[Repeat the same structure as Phase 1 for each subsequent phase.]

---

## Data Model Summary (Final State After All Phases)

\`\`\`
[ASCII tree or short diagram showing how new tables/views relate to the
existing transactions/categories/budgets/plans/profiles model.]
\`\`\`

### `[new_table]` — Schema
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, `default gen_random_uuid()` |
| `user_id` | uuid | RLS, FK → `auth.users` |
| `created_at` | timestamptz | `default now()` |
| [...] | [...] | [...] |

### `[new_view]` — Computed Read
[What it computes, what it's queried from, what columns it exposes.]

---

## Impact on Existing Features

| Existing Feature | Impact | Action Required |
|---|---|---|
| [...] | [...] | [...] |

---

## Out of Scope (All Phases)

[Explicit list of things that will NOT be built as part of this feature.
Be specific — future phases, related ideas, things that came up during
planning but were cut.]

- [Item] — [brief reason or "future build"]
- [...]
```
