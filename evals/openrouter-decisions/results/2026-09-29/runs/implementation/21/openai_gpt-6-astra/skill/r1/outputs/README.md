# Incident urgency

Server-side TypeScript scoring for incident reports. Uses OpenRouter's Decisions API with one `score` question and five ordered criteria. Input is `{ service, text }`; output includes integer `urgency` (1 = routine, 5 = critical), a fractional `sortScore` for ties, the resolved model, and optional probabilities and confidence.

```sh
npm install
export OPENROUTER_API_KEY='your-server-side-key'
echo '{"service":"checkout","text":"Purchases fail for many customers, with no workaround."}' | npm run rate
```

Use it in your ingestion handler:

```ts
import { rateIncident, compareUrgency, type UrgencyRating } from "./src/urgency.ts";

const report = { service: "checkout", text: "Purchases fail for many customers, with no workaround." };
let rating: UrgencyRating | null = null;
try {
  rating = await rateIncident(report);
} catch {
  // Persist the report as unscored for manual triage or a later retry.
}
const row = { ...report, rating };
// Persist `row` using your dashboard's existing storage.
const rows = [row];
rows.sort((a, b) => compareUrgency(a.rating, b.rating));
```

Unscored reports sort first so API failures remain visible, followed by descending urgency and descending fractional score. Sorting is stable for equal ratings. Keep the original report visible and support manual reprioritization; this module only orders reports and does not control paging or suppress incidents. There is no dashboard or storage implementation in this initially empty repository.

The rubric is routine (1), minor inconvenience (2), degradation with partial availability or a workaround (3), major production impact needing on-call intervention (4), and widespread outage, ongoing data loss, or harmful active compromise (5). Reports with no active impact, including off-topic reports, receive 1. Blank input and oversized reports are rejected before calling the API. Limits are 200 service characters and 12,000 report characters; text is never silently truncated. No numeric SLA or timestamp policy is inferred from free text.

The API score is a probability-weighted position from 0 through 4. Code maps it to levels 1–5 using named zero-based boundaries `[0.8, 1.5, 2.5, 3.5]`, with equality selecting the higher level. The first boundary separates observed cosmetic scores from minor functional failures; the others use nearest-level boundaries checked by the probes. `sortScore` is the raw score plus one. This is an ordinal sorting policy, not a calibrated measure of harm. Raw probability keys retain the API's zero-based indexing. Confidence describes distribution concentration; it does not establish correctness. No confidence threshold is used to hide or discard reports.

Requests time out after 15 seconds. Authentication, provider errors, invalid answers, and timeouts throw; never catch them by assigning urgency 1. The default logger records the resolved model and answer without incident text or credentials. Supply `log` to integrate your server logger. Keep API calls and credentials on your server.

Validation:

```sh
npm test
npm run check
npm run probe          # paid API calls: ten cases using the pinned build
npm run probe:compare  # paid API calls: same cases through the skill's catalog comparison
```

The live catalog and probe results selected `upstage/solar-decide-20260928`, pinned in `src/urgency.ts`. See [model selection](probes/selection.md) and the saved raw [comparison](probes/comparison.json). Rerun the probes after changing the model or rubric, then validate on your own labeled incidents. The comparison command requires the bundled `.agents/skills/openrouter-decisions` directory. Runtime scoring is independent of that directory; its request/response validation and HTTP client were copied from the skill into `src/decisions.ts`, with SDK/catalog helpers removed and a timeout added.
