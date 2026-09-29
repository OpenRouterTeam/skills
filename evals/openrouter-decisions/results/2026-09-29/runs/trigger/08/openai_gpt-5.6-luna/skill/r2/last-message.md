Put a grounding gate between answer generation and response delivery:

```text
retrieve passages
  → generate draft answer with chat model
  → Decisions API: “is the answer supported by these passages?”
  → return answer or refuse
```

Use a `noul` decision, since this is a yes/no judgment. Keep the chat model responsible for writing; use the Decisions API only for classification.

```ts
const GROUNDING_THRESHOLD = 0.90; // tune with representative probes

async function isGrounded(
  question: string,
  answer: string,
  passages: Array<{ id: string; text: string }>
): Promise<boolean> {
  const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DECISION_MODEL, // pin a concrete catalog model/version
      state: {
        user_question: question,
        draft_answer: answer,
        retrieved_passages: passages,
      },
      questions: {
        answer_supported: {
          type: "noul",
          instructions:
            "Is every material factual claim in the draft answer supported by the retrieved passages?",
          criteria: {
            true:
              "The passages entail the answer's claims. The answer may synthesize or paraphrase them, but must not add unsupported facts, assumptions, or conclusions.",
            false:
              "At least one material claim is missing, contradicted, overly specific, or only weakly implied by the passages.",
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Grounding check failed: ${response.status}`);
  }

  const result = await response.json();
  const decision = result.answers?.answer_supported;

  if (decision?.type !== "noul" || typeof decision.noul !== "number") {
    throw new Error("Malformed grounding decision");
  }

  return decision.noul >= GROUNDING_THRESHOLD;
}
```

Then fail closed at the endpoint boundary:

```ts
const passages = await retrieve(question);

const draft = await chatModel.generate({
  question,
  passages,
  instruction:
    "Answer only from the supplied passages. If they are insufficient, say so.",
});

const supported = await isGrounded(question, draft.text, passages);

if (!supported) {
  return {
    answer: "I couldn't verify that answer from the retrieved sources.",
    grounded: false,
  };
}

return {
  answer: draft.text,
  sources: passages.map(({ id }) => id),
  grounded: true,
};
```

For higher-stakes answers, check claims individually rather than asking whether a long answer is supported as a whole. The whole-answer version can hide one unsupported claim among several supported ones. Also probe the chosen decision model with clear, ambiguous, contradictory, empty-context, negated, and adversarial examples before setting the threshold; `0.90` above is only illustrative.