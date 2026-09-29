The Decisions API is the right tool here — it gives you actual probabilities instead of a string you have to guess at. Here's the drop-in replacement for your snippet, plus a calibration utility so you can pick thresholds from data rather than intuition.

```ts
// Replace the string-matching snippet with this:

const JE_MODEL = "typesafe/jev-latest";
const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";

// Thresholds: tune these from a labeled sample (see calibrate below)
const SPAM_THRESHOLD = 0.7;
const ABUSIVE_THRESHOLD = 0.7;

type Verdict = "spam" | "abusive" | "fine";

interface Classification {
  verdict: Verdict;
  spamProbability: number;
  abusiveProbability: number;
  uncertain: boolean;
}

interface JevAnswer {
  type: "noul";
  noul: number;
}

interface JevResponse {
  model: string;
  answers: Record<string, JevAnswer>;
}

async function classifyReview(review: string): Promise<Classification> {
  const res = await fetch(DECISIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: JE_MODEL,
      state: { review },
      questions: {
        spam: {
          type: "noul",
          instructions: "Is this review spam (promotional content, bot-generated, or off-topic advertising)?",
        },
        abusive: {
          type: "noul",
          instructions: "Is this review abusive (hateful, threatening, or harassing toward the seller, product, or other customers)?",
        },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Decisions API returned ${res.status}: ${await res.text()}`);
  }

  const body: JevResponse = await res.json();
  const spamProbability = body.answers.spam.noul;
  const abusiveProbability = body.answers.abusive.noul;

  let verdict: Verdict = "fine";
  if (abusiveProbability >= ABUSIVE_THRESHOLD) {
    verdict = "abusive";
  } else if (spamProbability >= SPAM_THRESHOLD) {
    verdict = "spam";
  }

  // Flag borderline cases for manual review if desired
  const uncertain =
    (verdict !== "fine") &&
    (Math.abs(spamProbability - 0.5) < 0.15 || Math.abs(abusiveProbability - 0.5) < 0.15);

  return { verdict, spamProbability, abusiveProbability, uncertain };
}
```

**Why this works better**

- `noul` questions return a single probability (0–1) per question, so you branch on numbers and pick thresholds that match your precision/recall tolerance — no string parsing, no brittleness to wording.
- Each question is judged independently, so a review can be both spammy and abusive if you set separate thresholds per label.
- The `uncertain` flag gives you a hook to route borderline items (probability near 0.5) to a human review queue instead of silently mislabeling them.

**Picking thresholds from data**

Label 100–200 reviews by hand, run them through `classifyReview`, and sweep thresholds to find where precision and recall meet your tolerance:

```ts
function precisionRecall(
  labeled: { review: string; isSpam: boolean }[],
  results: Classification[],
  threshold: number
) {
  let tp = 0, fp = 0, fn = 0;
  labeled.forEach((item, i) => {
    const predicted = results[i].spamProbability >= threshold;
    if (predicted && item.isSpam) tp++;
    else if (predicted && !item.isSpam) fp++;
    else if (!predicted && item.isSpam) fn++;
  });
  return {
    precision: tp + fp === 0 ? undefined : tp / (tp + fp),
    recall: tp + fn === 0 ? undefined : tp / (tp + fn),
  };
}

const THRESHOLDS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const sweep = THRESHOLDS.map((t) => ({ threshold: t, ...precisionRecall(sample, sampleResults, t) }));
```

If precision stays low at every threshold, tighten the `instructions` wording rather than pushing the threshold higher — an ambiguous question won't be fixed by a cutoff.