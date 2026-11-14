# 05: Accounts screen with transfers

Spec: .claude/features/archive/38-home-insights-more.md

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

- [x] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal

## Comments

**2026-10-26 (Claude):** Built.
- **New `app/accounts.js`** (native header "Accounts"), reached from More → Accounts. It lists each account with its colour, name and in-hand balance; the active one carries a check.
- **Actions:**
  - tap an account to make it active;
  - **Edit** opens the account sheet;
  - **Transfer** appears only with 2+ accounts and opens the Add sheet as a transfer, with From set to that account (new `fromAccountId` payload);
  - **New account** keeps the Free-limit gate (open while `billing` is off).
- **Add sheet:** the "Transfer between accounts" and "Back to expense" links are gone, so the sheet can't become a transfer by itself. Tapping an existing transfer still opens it as a transfer to edit.
- The account switcher sheet stays for Home's header (06).
- Open (emulator checks paused): one account shows no Transfer; with two, a transfer writes both legs (MCP); editing an existing transfer still works; light and dark.
