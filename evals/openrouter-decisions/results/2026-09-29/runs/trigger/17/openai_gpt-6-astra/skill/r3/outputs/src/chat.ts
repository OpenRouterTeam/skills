import { OpenRouter } from "@openrouter/sdk";

async function main(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Set OPENROUTER_API_KEY in your environment or .env file.");
  }

  const openRouter = new OpenRouter({ apiKey });
  const completion = await openRouter.chat.send({
    chatRequest: {
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: process.argv.slice(2).join(" ") || "Say hello in one short sentence.",
        },
      ],
      stream: false,
      maxTokens: 128,
    },
  });

  if (!("choices" in completion)) {
    throw new Error("OpenRouter returned an unexpected streaming response.");
  }
  const content = completion.choices[0]?.message.content;
  if (!content) {
    throw new Error("OpenRouter returned no assistant text.");
  }
  console.log(content);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Chat completion failed.");
  process.exitCode = 1;
});
