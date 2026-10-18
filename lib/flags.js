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
};
