import { OpenRouter } from "@openrouter/sdk";

async function main(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey || apiKey === "your_openrouter_api_key_here") {
    throw new Error("Set OPENROUTER_API_KEY in your environment or .env file.");
  }

  const client = new OpenRouter({ apiKey });
  const completion = await client.chat.send({
    chatRequest: {
      model: process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "user",
          content: process.argv.slice(2).join(" ").trim() || "Say hello in one short sentence.",
        },
      ],
      stream: false,
      maxTokens: 128,
    },
  });

  if (!("choices" in completion)) {
    throw new Error("OpenRouter unexpectedly returned a streaming response.");
  }
  const content = completion.choices[0]?.message.content;
  if (!content) {
    throw new Error("OpenRouter returned no message content.");
  }
  console.log(content);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  console.error(`Chat completion failed: ${apiKey ? message.replaceAll(apiKey, "[REDACTED]") : message}`);
  process.exitCode = 1;
});
