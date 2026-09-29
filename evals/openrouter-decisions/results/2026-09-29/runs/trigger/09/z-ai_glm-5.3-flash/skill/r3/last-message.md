Here's the code in `lead_routing.ts:1`:

- `classifyLead` (`lead_routing.ts:31`) applies your deterministic rules first — headcount > 1000 or 3+ regions → Enterprise, skipping the model entirely.
- Free-text leads go to Jev via a `noul` question (`lead_routing.ts:44`): "Does the free text describe a company-wide rollout?" The state sends only the raw `lookingFor` string.
- The result gates at `noul >= 0.5` (`lead_routing.ts:27`). A network error, missing answer, or non-numeric result falls through to **SMB** — the safe default — rather than guessing Enterprise.
- Typecheck passes cleanly.

Before trusting the 0.5 gate, run a probe set (clear team-pilot, clear "roll out company-wide", ambiguous, adversarial) through `decide.ts --compare` per the skill's step 8 to confirm the threshold from observed probabilities.