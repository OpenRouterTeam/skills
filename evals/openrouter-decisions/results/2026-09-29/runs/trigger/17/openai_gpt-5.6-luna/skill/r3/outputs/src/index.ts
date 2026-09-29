import "dotenv/config";
import OpenAI from "openai";

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  throw new Error(
    "Missing OPENROUTER_API_KEY. Copy .env.example to .env and add your key."
  );
}

const client = new OpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    ...(process.env.OPENROUTER_SITE_URL
      ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL }
      : {}),
    ...(process.env.OPENROUTER_SITE_NAME
      ? { "X-Title": process.env.OPENROUTER_SITE_NAME }
      : {}),
  },
});

const completion = await client.chat.completions.create({
  model: "openai/gpt-4o-mini",
  messages: [
    {
      role: "user",
      content: "Say hello in one short sentence.",
    },
  ],
});

console.log(completion.choices[0]?.message?.content ?? "No response returned.");
