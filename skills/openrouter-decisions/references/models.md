# Choosing a decision model on OpenRouter

Every decision model on OpenRouter speaks the same Decisions API and the same three primitives, so an integration written against one runs against any other with a config change. What differs is in the catalog (context length, price, providers, release date) or only shows up when you probe (how a model answers your questions, its latency, how spread its probabilities are). This page is the criteria. The catalog is the inventory, and it changes without this page changing.

## Read the live catalog

```bash
npx tsx scripts/models.ts request.json      # table with fit for this request
npx tsx scripts/models.ts --json            # every field below
curl -s "https://openrouter.ai/api/v1/models?output_modalities=decisions"
```

Only entries whose `architecture.output_modalities` contains `decisions` accept `POST /api/alpha/decisions`. Per entry:

| Field | Use |
| --- | --- |
| `id` | The model ID a request sends. A leading `~` marks an alias. |
| `alias_target.slug` | Set on aliases only. The pinned model the alias currently resolves to. |
| `canonical_slug` | The dated build behind the ID, such as `vendor/model-1.2-20260917`. Requests accept it, and the response `model` field returns it. |
| `context_length` | Tokens of state plus questions the model reads. |
| `pricing.prompt`, `pricing.completion` | USD per token as strings. Multiply by 1,000,000 for the per-million figure. |
| `created` | Unix seconds of the release. |
| `description` | The vendor's account of what the model is trained for and built on. Read it, do not trust it over a probe. |
| `links.details` | Path of the endpoints listing: provider names, per-provider context length, quantization, and recent uptime. |

## Criteria, in order

1. **Pinned, not aliased.** Production config holds a `canonical_slug` or a versioned `id`, never an alias, because an alias moves to a new build and the thresholds you set in step 8 belong to the build you probed. Log the response `model` with every stored answer so a later drift is traceable.
2. **Fit.** The request's state plus questions must fit `context_length` with room to spare, and the per-provider `context_length` in the endpoints listing can be lower than the model's. `models.ts request.json` estimates the tokens as a lower bound and marks each model `ok`, `tight`, or `no`. The probe's `usage.input_tokens` is the real number.
3. **Price at your volume.** `pricing.prompt` times the probe's `usage.input_tokens` plus `pricing.completion` times `usage.output_tokens`, times calls per day. When `pricing.completion` is 0, a smaller state is the whole lever.
4. **Availability.** One provider is one point of failure. Read the provider count, quantization, and `uptime_last_30m` from the endpoints listing, and treat a 429 or 5xx during the probe as an observation about that provider.
5. **Measured behavior on your questions.** The catalog says nothing about quality. Run the step 8 probe set through every remaining candidate with `decide.ts --compare` and compare per model: whether each case lands on the routing you want, how far the probabilities sit from your gates on the clear cases, latency, and cost. A model that answers the clear cases with the same probabilities as another but is cheaper or smaller wins. A model that fails the probe set is out, however good its description.
6. **Deployment shape.** A small open-weight model can be self-hosted, and a hosted-only model cannot. This matters only when your constraints say so.

## Switching models

A threshold does not carry between models, so a switch is the config change plus a rerun of step 8 on the new build. Run `decide.ts --compare` on the same probe set first so the decision is on observed numbers rather than the description. If a candidate errors during the comparison, record the error as the result for that model. It is not evidence of quality either way, only that this run could not measure it.

## Vendor material

A model's `description` names its vendor and lineage. When the vendor publishes a limits or weaknesses page, read it against [decision-model-limits.md](decision-model-limits.md) and probe any difference. Models on TypeSafe's System One contract (the `description` says so) also answer `POST https://openrouter.ai/api/v1/systemone` with the bare model ID after the vendor prefix, which is the path for teams already on the TypeSafe SDK with `baseURL: 'https://openrouter.ai/api'` ([OpenRouter guide](https://openrouter.ai/docs/guides/community/typesafe-sdk)). The Decisions API, `POST /api/alpha/decisions`, takes the full `id` and is the contract every entry the catalog returns for `output_modalities=decisions` declares.
