import { OpenRouter } from "@openrouter/sdk";

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  throw new Error("Set OPENROUTER_API_KEY before running this example.");
}

const openrouter = new OpenRouter({ apiKey });

const response = await openrouter.chat.send({
  chatRequest: {
    model: "openai/gpt-4o-mini",
    stream: false,
    messages: [
      {
        role: "user",
        content: "Say hello in one short sentence."
      }
    ]
  }
});

if ("choices" in response) {
  console.log(response.choices[0]?.message?.content ?? "No response content.");
}
