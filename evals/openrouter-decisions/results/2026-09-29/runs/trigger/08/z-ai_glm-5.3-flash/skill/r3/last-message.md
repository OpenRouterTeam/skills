## How it works

After your chat model generates an answer, you make a **second, cheap call** to OpenRouter's Decisions API (endpoint: `POST https://openrouter.ai/api/alpha/decisions`). It doesn't generate text — it reads your state (the answer + the retrieved passages) and returns a probability that the answer is grounded in them. Your code then gates on that probability before returning the answer to the user.

## Wiring

Add a grounding-check step between generation and the HTTP response:

```typescript
import { OpenRouter } from '@openrouter/sdk';

// Named threshold — tune from real cases, don't use 0.5 blindly.
const GROUNDING_THRESHOLD = 0.85;

async function checkGrounding(
  answer: string,
  passages: { id: string; text: string }[],
): Promise<boolean> {
  const client = new OpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    serverURL: 'https://openrouter.ai', // Decisions lives outside /api/v1
  });

  const response = await client.alpha.decisions.create({
    decisionsRequest: {
      model: 'typesafe/jev-1.13', // pin a versioned slug from the live catalog
      state: {
        answer,
        passages, // retrieved chunks, keyed by id or text
      },
      questions: {
        is_supported: {
          type: 'noul',
          instructions:
            'Is the answer fully supported by the provided passages? ' +
            'Every factual claim in the answer must be directly stated or clearly inferable from the passages. ' +
            'Claims that contradict, extend beyond, or are absent from the passages count as unsupported.',
          criteria: {
            true: 'Every claim in the answer is backed by the passages.',
            false: 'At least one claim in the answer is unsupported by the passages.',
          },
        },
      },
    },
  });

  const answer = response.answers.is_supported;
  if (answer.type !== 'noul') throw new Error('unexpected answer type');
  return answer.noul >= GROUNDING_THRESHOLD;
}
```

Then in your RAG endpoint:

```typescript
const answer = await generateAnswer(question, retrievedPassages);

if (!(await checkGrounding(answer, retrievedPassages))) {
  return res.status(200).json({
    refusal: true,
    message: "I don't have enough information to answer that confidently.",
  });
}

return res.json({ answer });
```

## Design notes

- **`noul` is the right primitive** here — grounding is a single yes/no condition, not a choice among options or a score on a scale.
- **State only carries what the judgment needs**: the generated answer and the passages. Don't send the user's question separately unless you want the model to factor in whether the passages actually address it (you likely do — include it).
- **Threshold**: start at 0.5 before probing, then tune with real examples. Run clear grounded answers, hallucinated answers, partially supported answers, and adversarial passages through `decide.ts --compare` to set the number from observed probabilities.
- **Latency/cost**: this is a second call, so it adds one decision-model round trip. Decision models are small and cheap; the whole check should be a few hundred tokens and sub-cent.
- **Model choice**: don't pick from memory — list the current decision models via `GET /api/v1/models?output_modalities=decisions` and pick on context length, price, and provider availability for your volume.

The bundled `scripts/lib.ts` in the skill path wraps request validation and typed response parsing, so you can copy or import from there rather than hand-rolling the HTTP call.