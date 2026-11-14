// Cards' sections (spec 49, ticket 08): Seasonal first, then every other
// design under All cards, each in catalog order. Legacy themes (the stored
// 'ink' default) are never listed, and an empty Seasonal is left out.
//
// Each theme comes back with `locked`: always false while the economy is off
// (every design is choosable, as with gating off); while it's on, a theme the
// person doesn't own is locked.
export function cardSections(themes, { economy = false, ownedIds } = {}) {
  const owned = ownedIds instanceof Set ? ownedIds : new Set(ownedIds ?? []);
  const listed = (themes ?? [])
    .filter((t) => !t.legacy)
    .map((t) => ({ ...t, locked: economy ? !owned.has(t.id) : false }));
  const seasonal = listed.filter((t) => t.tier === 'seasonal');
  const rest = listed.filter((t) => t.tier !== 'seasonal');
  return [
    seasonal.length > 0 && { key: 'seasonal', title: 'Seasonal', themes: seasonal },
    { key: 'all', title: 'All cards', themes: rest },
  ].filter(Boolean);
}
