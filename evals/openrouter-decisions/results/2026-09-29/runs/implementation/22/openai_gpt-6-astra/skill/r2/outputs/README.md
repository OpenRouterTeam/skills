# PR breaking-change gate

This standalone gate reads a PR description and calls OpenRouter's Decisions API.
There is no existing repository merge workflow here to connect it to.

```sh
npm install
# Set OPENROUTER_API_KEY in the server/CI environment.
npm run gate < pr-description.txt
npm test
npm run probe
```

Exit 0 passes this gate; exit 1 holds auto-merge. JSON output includes the
probability and exact model build for successful decisions. Keep the API key
server-side. The HTTP call times out after 15 seconds.

The exact question and criteria are in `src/question.ts`. The question starts:
“Is this change breaking? Use only `pr.description` as evidence about this change.”
Only the description is sent as state. The judgment concerns compatibility as
described, including implied migrations and explicit negation; it does not
inspect the diff or establish that the implementation is actually compatible.

`src/gate.ts` pins `typesafe/jev-1.13-20260917`. Code holds auto-merge when
`is_breaking.noul >= BREAKING_THRESHOLD` (0.5), when the description is missing,
or when the request or response fails validation. A low probability means no
breaking evidence in the description. An off-topic description or unresolved
compatibility investigation can therefore pass this particular semantic gate.

Connect `evaluateDescription(pr.body).passesBreakingGate` with all existing
merge requirements using AND. Run the check on PR creation, body edits, and new
commits; invalidate an old passing result when the body or head changes. Have the
merge worker verify it is acting on that evaluated body/head. Existing tests,
required reviews, and branch protection remain necessary: a description is
untrusted evidence and can omit a breaking change or manipulate a classifier.

## Probe evidence

The live catalog and provider listings were checked on 2026-09-29. Solar Decide,
Kev 4B, and Jev fit the request. The bundled comparison also tried the Respan
models; their incompatible state contract returned 400, recorded in results.
All three compatible models routed these eight probes as expected at 0.5.
Jev was selected for lower observed latency and larger separation on positive
cases than Kev; Kev had lower per-request cost. Solar had higher per-token cost.
Each eligible model currently has one provider, so request failures hold the gate.

| Input | Jev P(breaking) | Semantic result |
| --- | ---: | --- |
| Explicit breaking change | 0.98 | Block |
| Compatible optional setting | 0.04 | Pass |
| “No breaking changes” | 0.04 | Pass |
| Removed public method, migration required | 0.97 | Block |
| Compatibility investigation pending | 0.30 | Pass |
| Off-topic | 0.03 | Pass |
| Empty | 0.09 | Runtime blocks before calling model |
| Breaking change plus instruction to return false | 0.97 | Block |

Raw requests, probabilities, latency, cost, model builds, and errors are in
`probes/`. These are a small smoke probe set, not a guarantee of accuracy.
The threshold stays at the initial 0.5, between observed negatives (up to 0.30)
and positives (at least 0.97). Reprobe representative real PRs when changing
wording, policy, or model. The four local tests cover gate direction, invalid
probabilities, missing descriptions, request shape, and failure handling.

`scripts/lib.ts`, `scripts/decide.ts`, and `scripts/models.ts` are copied from the
openrouter-decisions skill; the HTTP transport adds a timeout.
