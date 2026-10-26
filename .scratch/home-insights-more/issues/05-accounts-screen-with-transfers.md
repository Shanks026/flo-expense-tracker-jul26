# 05: Accounts screen with transfers

Spec: .claude/features/38-home-insights-more.md

**What to build:** More → Accounts opens a screen that:
- lists your accounts;
- lets you add an account;
- lets you switch the active account.

With 2+ accounts, each account's actions include **Transfer**, which moves money to another account (the existing transfer logic). Transfer is removed from the Add sheet's type toggle. Editing an existing transfer still works.

**Blocked by:** 03 (Five tabs and the More screen)

**Status:** ready-for-agent

- [ ] More → Accounts lists accounts, and you can add one and switch to one
- [ ] With 1 account there is no Transfer action anywhere
- [ ] With 2+ accounts, Transfer from an account's actions creates both legs (MCP)
- [ ] The Add sheet type toggle has no Transfer; tapping an existing transfer still edits it
- [ ] Checked in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
