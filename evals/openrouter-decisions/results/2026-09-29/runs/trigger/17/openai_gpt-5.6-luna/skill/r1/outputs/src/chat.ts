import "dotenv/config";
import { OpenRouter } from "@openrouter/sdk";

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  throw new Error("OPENROUTER_API_KEY is required");
}

const openrouter = new OpenRouter({
  apiKey,
  ...(process.env.OPENROUTER_SITE_URL
    ? { httpReferer: process.env.OPENROUTER_SITE_URL }
    : {}),
  ...(process.env.OPENROUTER_APP_NAME
    ? { appTitle: process.env.OPENROUTER_APP_NAME }
    : {}),
});

const response = await openrouter.chat.send({
  chatRequest: {
    model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: "In one short sentence, explain what OpenRouter does.",
      },
    ],
    stream: false,
  },
});

if ("choices" in response) {
  console.log(response.choices[0]?.message?.content ?? "No response content");
} else {
  throw new Error("Expected a non-streaming chat response");
}
