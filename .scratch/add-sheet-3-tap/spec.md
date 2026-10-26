# Add sheet: 3-tap logging

Spec: .claude/features/36-add-sheet-3-tap.md

Decisions made while ticketing (2026-10-26):
- Transfer leaves the type toggle but stays reachable through a "Transfer between accounts" link in Details, shown with 2+ accounts, until spec 38 gives it a home in Accounts.
- The save haptic uses `expo-haptics` (first-party Expo; a native module, so it needs a rebuild).
- The new-user grid is Food, Groceries, Transport, Shopping, Bills, Health, Entertainment, Other. The spec's "Fun" is the seeded "Entertainment", and Rent, also seeded, sits under More.
- All four tickets touch the Add sheet, so they run in a straight line.
