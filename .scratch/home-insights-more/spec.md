# Home, Insights and More: lean v1 information architecture

Spec: .claude/features/archive/38-home-insights-more.md

Decisions made while ticketing (2026-10-26):
- Plans (01) and split invites + currency picker (02) are separate tickets, so each can be checked on its own.
- Settings (09) waits on 02 and 07 because both also edit the Settings screen.
- When 03 removes the Menu sheet, the Report screen is reachable only from Home's ReportReadyCard until 07 retires it. This short gap is accepted.
- The recap ticket (10) stays here but is also blocked by spec 39's recap data, which has no tickets yet.
- There is no Accounts screen today (accounts live in the switcher sheet), so 05 builds one.
