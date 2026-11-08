# Issue tracker: Local Markdown

Tickets and wayfinder maps for this repo live as markdown files in `.scratch/`.
**Specs do not** — they live in `.claude/features/` (see below).

## Specs (FLO-specific)

- A spec produced by `/to-spec` is written as `.claude/features/NN-<slug>.md`
  (next free number) in the `flo-feature` skill's template, and gets a row in
  `.claude/features/00-index.md`. There is no `.scratch/<feature>/spec.md`.
- That file satisfies the flo-feature rule (planning doc before feature code).
- When a skill says "read the spec", read the `.claude/features/` file the
  ticket links to.
- `/to-tickets` also writes `.scratch/<feature-slug>/spec.md` as a **pointer
  stub** only, so the tracer board (below) finds the feature and its title:

  ```markdown
  # <spec title, same as the .claude/features doc's heading>

  Spec: .claude/features/NN-<slug>.md
  ```

  Never put spec content in the stub; the `.claude/features/` doc is the spec.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file. Each ticket links its spec (`Spec: .claude/features/NN-<slug>.md`) near the top.
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading
- Every implementation ticket ends with a `## Tracer` section (see below). Wayfinder tickets (with a `Type:` line) do not get one.

## Tracer board

The `tracer` mod (installed user-wide from `thmp-pnpm/mods/tracer`; `/tracer`
opens the pane) tracks each feature's tickets as dependency waves. It reads
`.scratch/<feature-slug>/spec.md` + `issues/*.md` (`Blocked by:` / `Status:`
lines) and skips folders that hold only a wayfinder `map.md`. End every
implementation ticket with:

```markdown
## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
```

**FLO override of the mod's built-in rule:** the mod says Verified means
"`pnpm lint` and `pnpm build` pass and the screens check out in the browser".
FLO has no lint, build or test script and no web target. Here, tick
`Verified` only when the app has been rebuilt (`npx expo run:android`, or a
`lite-preview` build) and the changed screens/flows check out on the
**Pixel_API_36** emulator (Android 16) with the test account; for a
Supabase-only change, when the migration's effect is verified via the
Supabase MCP. Everything else in the mod's rules stands: start only tickets
whose blockers have their green signal, tick `Code implementation` when the
code is written, never tick `Green signal` or set `Status: resolved` yourself
— the person does that in the Tracer pane.

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed). If what is being published is a spec, write it to `.claude/features/` instead (see above).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.
