import { OpenRouter } from "@openrouter/sdk";
const client = new OpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
});
const completion = await client.chat.send({
    model: "openai/gpt-4.1-nano",
    messages: [
        {
            role: "user",
            content: "Reply with exactly: OpenRouter is working.",
        },
    ],
});
console.log(completion.choices[0]?.message.content);
