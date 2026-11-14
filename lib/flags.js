// Build-time feature flags — static booleans, decided when the bundle is cut,
// never fetched at runtime (no remote flags). "Flagged off" means the UI is
// hidden and nothing new is written, but existing data is kept, so flipping a
// flag back on restores the feature as it was. Later specs add their flags
// here. See .claude/features/32-safe-closed-test-build.md.
export const FLAGS = {
  // Off until Play Billing ships (the Pro-with-Play-Billing spec turns it on).
  // While off, every Pro gate passes and no purchase surface is shown — the
  // entitlement read path is untouched, so turning it on brings the gates back.
  billing: false,
  // The game economy (34-streak-only.md): coins, XP and ranks, trophies, the
  // spin wheel, the Shop (with coin packs), card themes, Cards, the
  // rewards hub and history, reward bursts, the welcome bundle and rank-up.
  // Off in every build. While off, none of it renders and no reward_events
  // row is written (every writer in lib/rewardsMutations.js and
  // lib/cardThemeMutations.js is a no-op); the code and existing rows stay.
  // The streak, its freezes and its milestones are NOT part of it.
  economy: false,
  // Card themes and accent colours (43-themes-back-unlocked.md): Cards,
  // every card design and every accent, on their own, without the economy.
  // While off, the accent is fixed to lime and no card theme renders.
  themes: true,
  // Whether card themes have to be earned. While off, every theme counts as
  // owned and the coin economy isn't read. Spec 43's Phase 2 records how
  // gating should work when it's turned on (streak milestones, then Pro).
  themeGating: false,
  // The accent picker (46-quiet-ledger, redesign §2.2). Off because the
  // primary is neutral ink and a second personal colour would compete with
  // the card. While off, Cards hides the swatches,
  // profiles.theme_accent is neither read nor written, and old-token screens
  // use the default accent until they move to the ledger kit. The code and
  // every stored choice stay, so turning it back on restores each user's pick.
  accents: false,
  // Plans (38-home-insights-more.md): budgets and splits are v1's only "where
  // money belongs" concepts. While off, the Plans screens, their Menu entry,
  // plan alerts, plan badges on transaction rows, the Analytics/Report plan
  // sections and the split sheet's plan link are hidden. Plan rows and the
  // plan_id on linked transactions are kept as they are.
  plans: false,
  // Split invites (38-home-insights-more.md): off until settlement
  // confirmation and the activity log exist, so no new shared ledger can be
  // double-counted. While off, the invite/revoke rows, the /join/[code] route
  // and the pending-invite resume are hidden. Splits themselves (create, add
  // entries, settle, export) are untouched, and already-joined members stay.
  splitInvites: false,
  // Currency picker (38-home-insights-more.md): India-only launch. While off,
  // the picker is hidden everywhere, new accounts and bills are INR, and every
  // existing account/bill keeps and shows its stored currency.
  currencyPicker: false,
  // The AI assistant (44-ai-assistant.md): the Add sheet's quick-add line
  // now, voice and chat in later phases. On for the personal build. While
  // off, nothing AI renders anywhere and the Add sheet is as it was.
  ai: true,
};
