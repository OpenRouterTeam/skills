import { OpenRouter } from "@openrouter/sdk";

async function main(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === "your_openrouter_api_key_here") {
    throw new Error("Set OPENROUTER_API_KEY in your environment or .env file.");
  }

  const openRouter = new OpenRouter({ apiKey });
  const prompt = process.argv.slice(2).join(" ").trim() ||
    "Say hello in one short sentence.";

  const completion = await openRouter.chat.send({
    chatRequest: {
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 128,
      stream: false,
    },
  });

  if (!("choices" in completion)) {
    throw new Error("Expected a non-streaming chat completion.");
  }
  const content = completion.choices[0]?.message.content;
  if (!content) {
    throw new Error("OpenRouter returned no text for this prompt.");
  }
  console.log(content);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Chat completion failed.");
  process.exitCode = 1;
});
