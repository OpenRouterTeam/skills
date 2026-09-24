import type { InboundTicket } from "../tickets/categorize";

export type Article = { slug: string; title: string; summary: string; embedding: number[] };

const SUGGEST_THRESHOLD = 0.78;

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function suggestArticle(
  ticket: InboundTicket,
  articles: Article[],
  embed: (text: string) => Promise<number[]>
): Promise<Article | null> {
  const query = await embed(`${ticket.subject}\n${ticket.body}`);
  const ranked = articles
    .map((article) => ({ article, similarity: cosine(query, article.embedding) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
  const top = ranked[0];
  if (!top || top.similarity < SUGGEST_THRESHOLD) return null;
  return top.article;
}
