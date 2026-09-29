import type { InboundTicket } from "./categorize";

export type Urgency = 1 | 2 | 3 | 4 | 5;

const PROMPT = `You are a support triage assistant. Rate the urgency of the following ticket from 1 (no rush) to 5 (production down, revenue impact, or security incident). Reply with the number only.

Subject: {subject}
Body: {body}`;

export async function rateUrgency(ticket: InboundTicket, chat: (prompt: string) => Promise<string>): Promise<Urgency> {
  const prompt = PROMPT.replace("{subject}", ticket.subject).replace("{body}", ticket.body);
  const reply = await chat(prompt);
  const match = reply.match(/[1-5]/);
  if (!match) return 3;
  const n = Number(match[0]);
  if (n === 5 && ticket.customerPlan === "free") return 4;
  return n as Urgency;
}
