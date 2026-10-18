# Share-to-FLO import v1 scope (SMS/UPI fast path)

Map: [../map.md](../map.md)
Type: grilling
Labels: wayfinder:grilling
Status: open
Blocked by: 

## Question

What does share-to-FLO import do in v1?

The audit names it the "faster than typing" path on Android: share a bank SMS or UPI receipt into FLO and land in a pre-filled Add sheet.

Grill:
- Which sources are supported at launch?
- What gets parsed: amount, merchant, date, type?
- What happens when parsing fails?
- Does import appear in onboarding?
- How does it stay clear of auto-detect, which is personal-only and never shipped?

Known constraint: the expo-share-intent 5.1.1 upgrade.

Refs: audit §1 P1 share-to-FLO, §5 P1 share import, §6 dependency hygiene.
