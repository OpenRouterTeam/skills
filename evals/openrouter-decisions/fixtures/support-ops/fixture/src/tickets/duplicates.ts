import type { InboundTicket } from "./categorize";

export type OpenTicket = { id: string; subject: string; body: string; status: "open" | "pending" };

const STOP = new Set(["the", "a", "an", "is", "to", "and", "of", "in", "on", "my", "i", "it", "for", "with"]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP.has(t))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

const DUPLICATE_THRESHOLD = 0.42;

export function findDuplicate(ticket: InboundTicket, open: OpenTicket[]): OpenTicket | null {
  const candidates = open.filter((t) => t.status === "open").slice(0, 10);
  const mine = tokens(`${ticket.subject} ${ticket.body}`);
  let best: OpenTicket | null = null;
  let bestScore = 0;
  for (const other of candidates) {
    const score = jaccard(mine, tokens(`${other.subject} ${other.body}`));
    if (score > bestScore) {
      best = other;
      bestScore = score;
    }
  }
  return bestScore >= DUPLICATE_THRESHOLD ? best : null;
}
