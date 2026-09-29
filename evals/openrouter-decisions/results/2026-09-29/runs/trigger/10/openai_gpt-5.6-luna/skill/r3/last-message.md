Use one independent `noul` decision per candidate, then rank candidates in code by `P(same_issue)`. This handles paraphrases and preserves a meaningful “none are duplicates” outcome.

```json
{
  "model": "YOUR_PINNED_DECISION_MODEL",
  "state": {
    "new_ticket": {
      "title": "Checkout shows a blank page after payment",
      "description": "The payment succeeds, but the order confirmation page is empty in Chrome."
    },
    "candidates": {
      "ticket_1842": {
        "title": "Blank confirmation screen after successful checkout",
        "description": "Customers pay successfully but see a white page instead of the receipt."
      },
      "ticket_1931": {
        "title": "Payment failed for some users",
        "description": "Card payments are declined intermittently."
      }
    }
  },
  "questions": {
    "ticket_1842": {
      "type": "noul",
      "instructions": "Is `new_ticket` describing the same underlying customer issue as candidate `ticket_1842`?",
      "criteria": {
        "true": "The tickets describe the same defect or incident, even if wording, symptoms, examples, or technical terminology differ.",
        "false": "They only share a product area or broad symptom, or involve a materially different cause, workflow, failure mode, or request."
      }
    },
    "ticket_1931": {
      "type": "noul",
      "instructions": "Is `new_ticket` describing the same underlying customer issue as candidate `ticket_1931`?",
      "criteria": {
        "true": "The tickets describe the same defect or incident, even if wording, symptoms, examples, or technical terminology differ.",
        "false": "They only share a product area or broad symptom, or involve a materially different cause, workflow, failure mode, or request."
      }
    }
  }
}
```

Then rank by the returned `noul` probability:

```ts
type Match = {
  ticketId: string;
  probability: number;
};

function rankDuplicates(
  answers: Record<string, { type: string; noul?: number }>
): Match[] {
  return Object.entries(answers)
    .map(([ticketId, answer]) => {
      if (answer.type !== "noul" || typeof answer.noul !== "number") {
        throw new Error(`Invalid decision answer for ${ticketId}`);
      }

      return { ticketId, probability: answer.noul };
    })
    .sort((a, b) => b.probability - a.probability);
}
```

A practical workflow is:

```ts
const ranked = rankDuplicates(response.answers);

const top = ranked[0];

if (!top || top.probability < REVIEW_THRESHOLD) {
  return { action: "no_confident_duplicate", ranked };
}

if (top.probability >= AUTO_LINK_THRESHOLD) {
  return { action: "link_to_duplicate", ticketId: top.ticketId, ranked };
}

return { action: "human_review", ranked };
```

Keep the thresholds configurable and calibrate them with representative tickets, including clear duplicates, paraphrases, near-misses, unrelated tickets, negations, and ambiguous cases. The model should only judge similarity; retrieval, candidate selection, sorting, thresholding, and ticket-linking remain deterministic application code.