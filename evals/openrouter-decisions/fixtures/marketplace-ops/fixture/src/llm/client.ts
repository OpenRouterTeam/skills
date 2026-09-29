export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chatComplete(messages: ChatMessage[]): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.CHAT_MODEL ?? "openai/gpt-5.6-luna", messages }),
  });
  if (!res.ok) throw new Error(`chat completion failed: ${res.status}`);
  const body = (await res.json()) as { choices: { message: { content: string } }[] };
  return body.choices[0]?.message.content ?? "";
}
