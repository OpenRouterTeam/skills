#!/bin/bash
# Oracle reference solution. Agents never see this.
set -euo pipefail

cd /app

cat > package.json <<'EOF'
{
  "name": "or-bench-streaming-chat",
  "private": true,
  "type": "module",
  "scripts": {
    "eval": "node index.mjs"
  }
}
EOF

cat > index.mjs <<'EOF'
import { writeFileSync } from "node:fs";

const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "openai/gpt-5-nano",
    stream: true,
    usage: { include: true },
    messages: [{ role: "user", content: "Reply with exactly the word: pong" }],
  }),
});

if (!res.ok) {
  throw new Error(`OpenRouter request failed: ${res.status} ${await res.text()}`);
}

const decoder = new TextDecoder();
let buffer = "";
let content = "";
let generationId = "";
let model = "";
let usage = null;

for await (const chunk of res.body) {
  buffer += decoder.decode(chunk, { stream: true });
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6);
    if (data === "[DONE]") continue;
    const event = JSON.parse(data);
    generationId = event.id ?? generationId;
    model = event.model ?? model;
    content += event.choices?.[0]?.delta?.content ?? "";
    if (event.usage) usage = event.usage;
  }
}

if (!usage) throw new Error("no usage in stream; usage accounting not enabled?");

writeFileSync(
  "/app/out.json",
  JSON.stringify(
    {
      generationId,
      model,
      content,
      usage: {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
      },
    },
    null,
    2,
  ),
);
console.log("wrote /app/out.json");
EOF

npm run eval
