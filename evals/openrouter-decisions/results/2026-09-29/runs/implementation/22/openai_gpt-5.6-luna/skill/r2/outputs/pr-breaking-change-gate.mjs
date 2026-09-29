#!/usr/bin/env node

// CI gate: exit 1 when the PR description indicates a breaking change.
const MODEL = "typesafe/jev-1.13-20260917";
const BREAKING_THRESHOLD = 0.5;

const description = process.env.PR_DESCRIPTION ?? "";
const request = {
  model: MODEL,
  state: { pull_request_description: description },
  questions: {
    is_breaking_change: {
      type: "noul",
      instructions:
        "Is the proposed software change a breaking change based on `pull_request_description`? Judge the change described, not merely whether the words 'breaking change' appear.",
      criteria: {
        true:
          "The description says or clearly implies that existing users, clients, integrations, data, configuration, or documented behavior will stop working or require migration, including an explicitly marked breaking change.",
        false:
          "The description says the change is backward-compatible, non-breaking, or only adds/fixes/refactors behavior without requiring existing users or integrations to change.",
      },
    },
  },
};

function fail(message) {
  console.error(`Breaking-change gate error: ${message}`);
  process.exit(2);
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) fail("OPENROUTER_API_KEY is not set");

console.log("Decision question:");
console.log(JSON.stringify(request.questions.is_breaking_change, null, 2));

const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(request),
});

const body = await response.text();
if (!response.ok) fail(`OpenRouter returned HTTP ${response.status}: ${body}`);

let result;
try {
  result = JSON.parse(body);
} catch {
  fail("OpenRouter returned invalid JSON");
}

const answer = result.answers?.is_breaking_change;
if (answer?.type !== "noul" || typeof answer.noul !== "number") {
  fail("response did not contain a typed is_breaking_change noul answer");
}

const probability = answer.noul;
console.log(`P(breaking change)=${probability.toFixed(3)} (model=${result.model})`);

if (probability >= BREAKING_THRESHOLD) {
  console.error("Auto-merge blocked: the PR is likely breaking.");
  process.exit(1);
}

console.log("Auto-merge gate passed: the PR is not likely breaking.");
