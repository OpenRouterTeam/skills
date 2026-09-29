#!/usr/bin/env node

import fs from "node:fs";

const MODEL = "typesafe/jev-1.13-20260917";
const BREAKING_THRESHOLD = 0.5;
const MAX_DESCRIPTION_LENGTH = 20000;

const description = process.env.PR_DESCRIPTION ?? "";
const outputFile = process.env.GITHUB_OUTPUT;

function setOutput(name, value) {
  if (!outputFile) return;
  fs.appendFileSync(outputFile, `${name}<<EOF\n${value}\nEOF\n`);
}

function block(reason) {
  console.log(`Auto-merge blocked: ${reason}`);
  setOutput("should_merge", "false");
  setOutput("reason", reason);
}

if (!description.trim()) {
  block("the PR has no description to evaluate");
  process.exit(0);
}

if (description.length > MAX_DESCRIPTION_LENGTH) {
  block(`the PR description exceeds ${MAX_DESCRIPTION_LENGTH} characters`);
  process.exit(0);
}

const request = {
  model: MODEL,
  state: { pull_request_description: description },
  questions: {
    is_breaking_change: {
      type: "noul",
      instructions:
        "Is the change described by this pull request a breaking change? Judge the change itself from `pull_request_description`, not whether the author used a particular keyword. Treat a change as breaking when it removes, changes, or makes incompatible an existing public API, behavior, data format, configuration contract, or user workflow. A description that does not state or substantiate a breaking change is not enough to classify it as breaking.",
      criteria: {
        true: "The description states or clearly substantiates an incompatibility for existing users, callers, stored data, configuration, or workflows.",
        false: "The description explicitly says the change is non-breaking, or it does not state or substantiate an incompatibility.",
      },
    },
  },
};

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required");

  console.log("Question sent to the decision model:");
  console.log(JSON.stringify(request.questions.is_breaking_change, null, 2));

  const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`OpenRouter returned ${response.status}: ${JSON.stringify(body)}`);
  }

  const answer = body.answers?.is_breaking_change;
  if (!answer || answer.type !== "noul" || typeof answer.noul !== "number") {
    throw new Error("OpenRouter returned an invalid is_breaking_change answer");
  }

  const isBreaking = answer.noul >= BREAKING_THRESHOLD;
  const reason = isBreaking
    ? `breaking probability ${answer.noul.toFixed(3)} is at or above ${BREAKING_THRESHOLD}`
    : `breaking probability ${answer.noul.toFixed(3)} is below ${BREAKING_THRESHOLD}`;

  console.log(`Decision model: ${body.model ?? MODEL}`);
  console.log(`Breaking probability: ${answer.noul}`);
  if (isBreaking) {
    block(reason);
  } else {
    console.log(`Auto-merge allowed: ${reason}`);
    setOutput("should_merge", "true");
    setOutput("reason", reason);
  }
}

main().catch((error) => {
  console.error(error.message);
  setOutput("should_merge", "false");
  setOutput("reason", "decision model failed; manual review required");
  process.exit(1);
});
