# 11: Cleanup: delete what nothing imports

Spec: .claude/features/49-quiet-ledger-moments-and-the-rest.md

**What to build:** Delete the old components the redesign retired, once nothing imports them. Spec 49 §Cleanup.

- Candidates (spec 49 lists them): the Insights pieces retired in spec 48, the old due-bills card, `Confetti`, `PersonalizePreview`, the old flame cells, and the old shared pieces (`Card`, `IconTile`, `Pill`, `BackButton`, the old `Button`, `EmptyState`, `ProgressBar`, `Row`/`RowGroup`, `SegmentedChoice`, `Screen`, `Skeleton`, `FadeIn`, `IconButton`), plus dead helpers (the day-one recap copy, the old budget status rule and save toast if unused).
- A file goes only when a project-wide import search finds no importer; re-check after each deletion, since one deletion can free another.
- `theme/tokens.js`, the old theme context, Manrope and anything the economy screens use stay (economy left as is, 2026-11-14). Manrope unloads only if nothing references its family names; otherwise a comment names the economy as the reason.

**Blocked by:** 01–10

**Status:** ready-for-agent

- [ ] Each deleted file had no importer at deletion time; the list of deleted files is in the ticket's comments
- [ ] The check script passes
- [ ] The app cold-starts and Home, Activity, Insights, You, Settings, Ask FLO, Cards, Streak and a bill detail each open with no red screen
- [ ] Emulator check in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
