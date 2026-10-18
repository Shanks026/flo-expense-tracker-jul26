# FLO glossary

**v1** — the lean, retention-first release that goes to Google Play production. Defined by the v1-reset decisions, not by whatever happens to be on `master`.

**Lite build** — the store variant of FLO: never contains auto-detect. The only variant that is ever uploaded to Play.

**Personal build** — the variant that contains auto-detect. For the owner's own device only; never shipped, never hardened.

**Safe closed-test build** — the first lite build fit to start Play's closed test: auto-detect excluded and no price or Buy button shown. It need not contain the v1 reset; the reset reaches testers as later builds during the test.

**Closed test** — Play's required pre-production track: at least 12 testers opted in for 14 consecutive days before production access can be requested.
