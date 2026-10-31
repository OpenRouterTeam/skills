#!/bin/bash
# Oracle reference solution. Agents never see this.
set -euo pipefail

cd /app

cat > package.json <<'EOF'
{
  "name": "or-bench-structured-outputs",
  "private": true,
  "type": "module",
  "scripts": {
    "eval": "node index.mjs"
  }
}
EOF

cat > index.mjs <<'EOF'
import { writeFileSync } from "node:fs";

const text =
  "Maya Chen (reachable at maya.chen@example.com) joined the platform team " +
  "last spring. At 34, she is the youngest principal engineer in the org.";

const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "openai/gpt-5-nano",
    messages: [
      {
        role: "user",
        content: `Extract the person's name, email, and age from this text:\n\n${text}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "person",
        strict: true,
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            age: { type: "integer" },
          },
          required: ["name", "email", "age"],
          additionalProperties: false,
        },
      },
    },
  }),
});

if (!res.ok) {
  throw new Error(`OpenRouter request failed: ${res.status} ${await res.text()}`);
}

const body = await res.json();
const result = JSON.parse(body.choices[0].message.content);

writeFileSync(
  "/app/out.json",
  JSON.stringify({ generationId: body.id, model: body.model, result }, null, 2),
);
console.log("wrote /app/out.json");
EOF

npm run eval
