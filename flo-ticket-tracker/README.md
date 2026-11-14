# flo-ticket-tracker

FLO's copy of the global `ticket-tracker` mod, reworked for FLO's local markdown tracker (`docs/agents/issue-tracker.md`). It shows one card per ticket file in `.scratch/<feature>/issues/NN-<slug>.md`. It doesn't use GitHub issues.

## What a card shows

- **From the file** (re-read every 30 s, and after any edit under `.scratch/`):
  - the title;
  - the `Status:` line;
  - the `Blocked by:` line (a card is **Blocked** until each blocker is resolved or has its Green signal);
  - the `## Tracer` checklist (Code, Verified, Green signal).
- **From the session, for the active ticket only:**
  - Edited (any file edit outside `.scratch/`);
  - Review (`code-review` skill);
  - Commit (`git commit`, which also records the branch);
  - Pushed (`git push`).

The mod never writes to a ticket file. Green signal and `Status: resolved` stay the person's, as the tracer rules require. "Mark done" and "Start" change only the board.

## Use

- `/mattpocock-skills:implement .scratch/<feature>/issues/NN-*.md` adds that feature's tickets, makes NN active and opens the pane. Any implement run opens the pane, even for a ticket already on the board or with no path.
- The tracker finds `.scratch` from the session's current folder. If the shell has wandered into a subfolder, it reports "Not found" until you're back at the repo root.
- `/flo-tickets add nudge-and-weekly-recap` (or `nudge-and-weekly-recap/02`, or a ticket path) adds tickets by hand.
- `/flo-tickets features` lists the features that have an `issues/` folder; `/flo-tickets refresh` and `/flo-tickets clear` do what they say.
- The model drives the same board through the `mcp__flo-ticket-tracker__tickets` tool.

## Loading it

From the repo root:

```bash
claude --plugin-dir ./flo-ticket-tracker
```

Or add the folder's absolute path to `CLAUDE_CODE_PLUGIN_DIRS` in the `env` block of `~/.claude/settings.json` (the user file: a project's `.claude/settings*.json` is ignored for this variable). It then loads in every project; outside FLO it finds no `.scratch` and shows nothing.
