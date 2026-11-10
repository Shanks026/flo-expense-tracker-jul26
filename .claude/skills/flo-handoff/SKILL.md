---
name: flo-handoff
description: End a FLO ticket session — bring the effort's handoff doc, ticket files and records up to date, commit, and print the command that continues the next ticket in a new chat.
disable-model-invocation: true
---

# FLO handoff

The next chat starts cold: it knows only what the handoff doc and the ticket files say. Write them so a fresh agent can pick up the next ticket without this conversation.

## 1. Find the effort

The effort is the `.scratch/<effort>/` folder this session worked in (today usually `quiet-ledger`). Its handoff doc is `.scratch/<effort>/handoff.md`; its tickets are `.scratch/<effort>/issues/NN-*.md`. If the session touched more than one effort, do steps 2–5 for each.

Read `handoff.md` in full, and `git log --oneline` since the commit its "Last updated" line names (or since the last handoff commit). Done when you have the list of every commit and every decision this session made.

## 2. Bring each ticket file up to date

For every ticket this session started or finished:

- `**Status:**` is `resolved` only if it was built and the emulator check passed; otherwise leave it and say why in Comments.
- The acceptance checkboxes and the three `## Tracer` boxes are ticked only for what was actually verified (the person's standing rule: tick Green signal yourself once the emulator check passes).
- `## Comments` gains a dated line: what was built, what was checked and how, and **what wasn't checked**. Be specific; "not run live: voice, share" beats "mostly verified".

Done when no ticket's file disagrees with what the session did.

## 3. Rewrite `handoff.md`

Edit in place; keep its existing sections and voice.

- **"Last updated"** line: today's date and what this session covered.
- **Ticket table**: every row's state and commit hash(es). Replace any "this commit" with the real hash. Recompute what's blocked, since a finished ticket can unblock another.
- **Suggested order**: the next ticket in **bold**, then the rest.
- **Decisions**: every decision the person made this session that a later ticket must respect, one bullet each, with the date. Include changes the person asked for outside any ticket (they often reshape later tickets). Retire bullets that are now stale.
- **Gotchas**: anything that cost time and will cost it again (an emulator quirk, a tool the person declined, test data that must be put back). These belong in the handoff, not in a memory file, unless they hold across every FLO effort.
- **State left behind**: test-account data changed and restored, migrations applied, anything untracked on purpose.

Done when a fresh agent reading only `handoff.md` and the next ticket could start it without asking what happened.

## 4. Update the other records the session touched

Check each; edit only where the session changed what it records:

- the spec in `.claude/features/` (amended stories, inventory rows, rules);
- `.claude/features/00-index.md`: a migrations-table row and the schema table for any database change;
- the tracker: `mcp__flo-ticket-tracker__tickets` `refresh`.

## 5. Commit

Commit only the docs and ticket files from steps 2–4 (never `design-inspirations/` or `day-themes/`), with a `docs:` message naming the effort and the next ticket, ending with the attribution line. Leave pushing to the person.

## 6. Hand over

Reply with a short summary (what's done, what's next, what wasn't verified), then the continue command in a plain fenced block (untagged: it's a chat command, not a shell one), using the next ticket's real path:

```
/mattpocock-skills:implement .scratch/<effort>/issues/<NN-slug>.md — read .scratch/<effort>/handoff.md first
```

If the next ticket needs the person first (a database change, a design choice), say so above the command.
