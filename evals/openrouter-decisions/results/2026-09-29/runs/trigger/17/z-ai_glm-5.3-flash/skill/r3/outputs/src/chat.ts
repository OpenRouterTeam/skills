import { OpenRouter } from "@openrouter/sdk";

const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const completion = await client.chat.send({
  chatRequest: {
    model: "google/gemini-3.1-flash-lite",
    messages: [
      { role: "user", content: "Say hello in one sentence." },
    ],
  },
});

if (Symbol.asyncIterator in completion) {
  throw new Error("SDK returned a streaming response; expected a non-streaming completion.");
}

const choice = completion.choices[0];
console.log(choice?.message?.content);
console.log({
  promptTokens: completion.usage?.promptTokens,
  completionTokens: completion.usage?.completionTokens,
});
