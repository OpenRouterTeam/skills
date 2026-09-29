**Implementation**
- Added `src/incident-urgency.ts` — rates reports 1–5 using the Decisions API `score` primitive, with the pinned model `typesafe/jev-1.13-20260917`.
- Includes strict input validation, normalized level probabilities, and a `needsReview` flag when confidence is low.
- Added `sortIncidentReportsByUrgency` to rank reports by urgency, with optional on-review callback.
- Added `package.json` for metadata and build/check commands.

**Validation**
- Type check passes: `npx tsc --ignoreConfig --noEmit --strict --target es2022 --module nodenext --moduleResolution nodenext --lib es2022,dom --types node src/incident-urgency.ts`
- Live probe set confirms sensible behavior: outages rank high, minor issues rank low, and demanding language does not inflate urgency.