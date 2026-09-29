/**
 * Rank already-retrieved ticket candidates with OpenRouter Decisions.
 *
 * Retrieval stays in application code. This module only judges whether each
 * candidate describes the same underlying issue as the new ticket.
 */

const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";

export type Ticket = {
  id: string;
  title?: string;
  description: string;
};

export type RankedTicket = Ticket & {
  sameIssueProbability: number;
  rank: number;
};

export type RankOptions = {
  /** A pinned canonical/versioned Decisions model, never an alias. */
  model: string;
  apiKey?: string;
  signal?: AbortSignal;
};

type NoulAnswer = { type: "noul"; noul: number };
type DecisionsResponse = {
  model?: string;
  answers?: Record<string, NoulAnswer>;
};

const MAX_CANDIDATES = 20;

/**
 * Rank up to 20 candidates in one Decisions API call.
 * Ties retain the retrieval order, making results deterministic.
 */
export async function rankDuplicateCandidates(
  incoming: Ticket,
  candidates: readonly Ticket[],
  options: RankOptions,
): Promise<RankedTicket[]> {
  if (candidates.length > MAX_CANDIDATES) {
    throw new RangeError(`Expected at most ${MAX_CANDIDATES} candidates`);
  }
  if (new Set(candidates.map((candidate) => candidate.id)).size !== candidates.length) {
    throw new Error("Candidate IDs must be unique");
  }
  if (candidates.length === 0) return [];
  if (!options.model) throw new Error("A pinned Decisions model is required");

  // Keys are opaque, stable IDs rather than array indexes. This lets the
  // question criteria name the actual candidate being judged.
  const questions: Record<string, unknown> = {};
  for (const candidate of candidates) {
    questions[questionKey(candidate.id)] = {
      type: "noul",
      instructions:
        "Is this candidate ticket about the same underlying issue as the new ticket? " +
        "Treat paraphrases, different wording, and different reproduction details " +
        "as potentially the same issue. Require the same product area, failure or " +
        "requested outcome, and causal problem. Do not match merely because the " +
        "tickets share words, a customer, a component, or a broad topic. A feature " +
        "request and a bug report about the same area are different issues unless " +
        "they describe the same requested outcome.",
      criteria: {
        true: "The two tickets describe the same underlying issue, including a clear paraphrase.",
        false: "They are different issues, even if they concern the same product area or share terms.",
      },
    };
  }

  const response = await fetch(DECISIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey ?? env("OPENROUTER_API_KEY") ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      state: { new_ticket: incoming, candidates },
      questions,
    }),
    signal: options.signal,
  });

  const body: unknown = await response.json();
  if (!response.ok) throw new Error(`Decisions API ${response.status}: ${JSON.stringify(body)}`);
  if (!isRecord(body) || !isRecord(body.answers)) throw new Error("Decisions response has no answers");
  const answers = body.answers;

  const scored = candidates.map((candidate, index) => {
    const answer = answers[questionKey(candidate.id)];
    if (!isRecord(answer) || answer.type !== "noul" || typeof answer.noul !== "number") {
      throw new Error(`Missing or invalid decision for candidate ${candidate.id}`);
    }
    if (answer.noul < 0 || answer.noul > 1) {
      throw new Error(`Invalid probability for candidate ${candidate.id}`);
    }
    return { candidate, probability: answer.noul, index };
  });

  scored.sort((a, b) => b.probability - a.probability || a.index - b.index);
  return scored.map(({ candidate, probability }, index) => ({
    ...candidate,
    sameIssueProbability: probability,
    rank: index + 1,
  }));
}

function questionKey(id: string): string {
  // JSON object keys can contain arbitrary IDs; prefixing avoids collisions
  // with any future reserved question names.
  return `candidate_${id}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function env(name: string): string | undefined {
  const processLike = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return processLike?.env?.[name];
}
