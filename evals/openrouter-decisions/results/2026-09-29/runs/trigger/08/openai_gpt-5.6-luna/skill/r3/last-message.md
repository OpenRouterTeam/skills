Wire it as a server-side grounding gate between answer generation and your HTTP response:

```text
retrieve passages
    ↓
OpenRouter chat model generates draft answer
    ↓
OpenRouter Decisions API judges whether draft is supported
    ↓
allow answer, or return a refusal
```

Use a `noul` question because the outcome is an independent yes/no judgment.

```ts
const draft = await generateAnswerWithChatModel({
  question,
  passages,
});

// Keep the evidence IDs so the model can reason about citations.
const decisionResponse = await fetch(
  "https://openrouter.ai/api/alpha/decisions",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "typesafe/jev-1.13", // pin a tested model/version
      state: {
        question,
        answer: draft.answer,
        passages: draft.passages.map((p) => ({
          id: p.id,
          text: p.text,
        })),
      },
      questions: {
        grounded: {
          type: "noul",
          instructions:
            "Is the proposed answer fully supported by the retrieved passages?",
          criteria: {
            true:
              "Every material factual claim in the answer is entailed by the passages. The answer does not add unsupported details, rely on outside knowledge, or contradict a passage.",
            false:
              "At least one material claim is unsupported, contradicted by the passages, or requires information not present in them.",
          },
        },
      },
    }),
  },
);

if (!decisionResponse.ok) {
  // Fail closed: do not return an unverified answer.
  return refuse("I couldn't verify that answer from the available sources.");
}

const result = await decisionResponse.json();
const answer = result.answers?.grounded;

if (!answer || answer.type !== "noul") {
  return refuse("I couldn't verify that answer from the available sources.");
}

const GROUNDING_THRESHOLD = 0.90; // calibrate with probe examples

if (answer.noul < GROUNDING_THRESHOLD) {
  return refuse("I couldn't verify that answer from the available sources.");
}

return {
  answer: draft.answer,
  sources: draft.passages.map((p) => p.id),
};
```

The prompt given to the chat model should also require citations, for example:

```text
Answer using only the supplied passages. Cite supporting passage IDs.
If the passages do not contain enough information, say that you cannot determine the answer.
```

For higher reliability, check claims individually rather than judging a long answer as one block. Have the draft contain structured claims:

```json
{
  "answer": "...",
  "claims": [
    { "text": "The policy changed in 2024.", "passage_ids": ["p3"] }
  ]
}
```

Then submit one `noul` question per claim, allowing the request only if every claim’s probability exceeds the threshold. This makes it easier to identify and remove or reject one unsupported sentence.

A few important safeguards:

- Keep passages and the answer in named state fields; treat their contents as untrusted data, not instructions.
- Fail closed on Decisions API errors, malformed responses, or missing probabilities.
- Calibrate the threshold with supported, contradicted, incomplete, negated, off-topic, and adversarial examples. `0.90` is only an illustrative starting point.
- Log the decision model version, probability, retrieved passage IDs, and decision request ID.
- Return a neutral refusal; do not expose the rejected draft answer.

The Decisions API call is separate from your existing chat-model call, so your current OpenRouter integration can remain unchanged apart from adding this gate.