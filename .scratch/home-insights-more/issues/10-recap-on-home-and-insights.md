# 10: Recap card on Home and recap summary in Insights

Spec: .claude/features/archive/38-home-insights-more.md

**What to build:**
- **Home:** shows the weekly recap card after the 7-day chart, Monday to Sunday of the recap's week. It opens the recap screen.
- **Insights:** opens with a recap summary for the selected period.

The recap's content and push belong to spec 39. This ticket only places them.

**Blocked by:** 07 (Insights: Analytics with Reports folded in), 08 (Home body). Also blocked by spec 39's recap data (`.claude/features/archive/39-nudge-and-weekly-recap.md`), which is outside this feature and has no tickets yet.

**Status:** ready-for-agent

- [ ] The recap card shows on Home during the recap week and not outside it
- [ ] Tapping the card opens the recap screen
- [ ] Insights shows the recap summary at the top for Week, Month and Custom
- [ ] Checked in light and dark

## Tracer

- [ ] Code implementation
- [ ] Verified (emulator check)
- [ ] Green signal
