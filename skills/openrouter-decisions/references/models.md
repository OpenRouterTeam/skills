# Decision models on OpenRouter

What differs per model is its ID, context length, price, and the quirks you probe for before moving thresholds to it.

## Discover the current list

```bash
curl -s "https://openrouter.ai/api/v1/models?output_modalities=decisions" | jq '.data[] | {id, name, context_length, prompt_price: .pricing.prompt, alias_target: .alias_target.slug}'
```

Models whose `architecture.output_modalities` is `["decisions"]` accept `POST /api/alpha/decisions`. An entry with `alias_target` is a moving alias. Pin the target slug it points to for production.

## Swapping

To try another model, read its section below, then reprobe your own questions with `decide.ts --model <id>` before changing any threshold. Add a section when a new model appears.

## Jev (TypeSafe)

| ID | Meaning |
| --- | --- |
| `typesafe/jev-1.13` | Pinned release and the bundled scripts' default. |
| `~typesafe/jev-latest` | Alias that follows the newest Jev release. |

Context length is 32,000 tokens. Billing is per input token, output tokens are free, and `usage.cost` is in USD. Responses resolve to a dated build such as `typesafe/jev-1.13-20260917`.

Jev's documented weaknesses match the general table in [decision-model-limits.md](decision-model-limits.md) row for row (source: https://docs.typesafe.ai/model-jaggedness/jev-1.13.md). OpenRouter's Jev pages: [overview](https://openrouter.ai/docs/guides/community/jev), [first call tutorial](https://openrouter.ai/docs/guides/community/jev-tutorial), [TypeSafe SDK on OpenRouter](https://openrouter.ai/docs/guides/community/typesafe-sdk).

Jev is also reachable through the TypeSafe System One API at `POST https://openrouter.ai/api/v1/systemone`, for teams already on the TypeSafe SDK. The TypeSafe SDK appends `/v1/systemone` to its base URL and takes the bare model ID.

```typescript
import { TypeSafeClient } from '@typesafe-ai/sdk';

const client = new TypeSafeClient({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api' });
const result = await client.systemOne({ model: 'jev-1.13', state, questions });
```

```python
from typesafe_sdk import TypeSafeClient

client = TypeSafeClient(api_key=os.environ["OPENROUTER_API_KEY"], base_url="https://openrouter.ai/api")
result = client.system_one(model="jev-1.13", state=state, questions=questions)
```

TypeSafe's own docs: https://docs.typesafe.ai/llms.txt
