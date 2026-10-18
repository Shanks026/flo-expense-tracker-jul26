# Add sheet speed design (3-tap logging)

Map: [../map.md](../map.md)
Type: grilling
Labels: wayfinder:grilling
Status: open
Blocked by: 

## Question

How does the Add sheet get an expense logged in about 3 taps? It is the core loop and the first-expense step of onboarding ([03](03-onboarding-target-flow.md)), and it follows the design language from [04](04-design-language-direction.md).

Grill:
- **Smart default category:** last used? Most used at this time of day? A fixed default?
- **The category grid:** how many tiles (the audit says a top 8, onboarding a top 6), in what order, and whether it learns.
- **Saving:** a pinned Save button, and what the keyboard does on Save.
- **Defaults:** date defaults to today and the account defaults to the active one. How are they changed without adding taps?
- **Note and merchant:** optional, and where they sit.
- **Share-import:** how the sheet looks when pre-filled from share-import ([09](09-share-import-v1-scope.md)).
- **After Save:** what happens next. The streak moment and the "Nice one" Koban go through the moment queue from [02](02-gamification-scope.md).

Refs: audit §1 P0 "Make logging take 3 taps", §5 P0 "Speed up the Add sheet".
