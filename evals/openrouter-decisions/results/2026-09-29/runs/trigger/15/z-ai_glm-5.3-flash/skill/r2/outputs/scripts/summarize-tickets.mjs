#!/usr/bin/env node

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
const OPENROUTER_API_URL =
  process.env.OPENROUTER_API_URL || "https://openrouter.ai/api/v1/chat/completions";
const TICKETS_API_URL = process.env.TICKETS_API_URL;
const TICKETS_API_TOKEN = process.env.TICKETS_API_TOKEN;
const SUMMARY_FIELD = process.env.SUMMARY_FIELD || "summary";

if (!OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY is required");
  process.exit(1);
}

if (!TICKETS_API_URL) {
  console.error("TICKETS_API_URL is required");
  process.exit(1);
}

function ticketHeaders() {
  const result = { "Content-Type": "application/json" };
  if (TICKETS_API_TOKEN) result.Authorization = `Bearer ${TICKETS_API_TOKEN}`;
  return result;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${url} failed with ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

function ticketText(ticket) {
  const parts = [];
  for (const field of ["subject", "description", "body"]) {
    if (ticket[field]) parts.push(String(ticket[field]));
  }
  const messages = ticket.messages || ticket.conversation || ticket.comments || [];
  for (const message of messages) {
    parts.push(String(message.body || message.text || message.content || ""));
  }
  return parts.filter(Boolean).join("\n");
}

function extractTickets(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["tickets", "items", "data", "results"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  throw new Error("Could not find an array of tickets in the tickets API response");
}

async function summarize(ticket) {
  const state = JSON.stringify({
    id: ticket.id,
    subject: ticket.subject || ticket.title || "",
    status: ticket.status || "",
    conversation: ticketText(ticket),
  });

  const data = await fetchJson(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.APP_URL || "http://localhost",
      "X-Title": "Support ticket summarizer",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Write exactly one concise paragraph summarizing the support ticket. State the user's issue, key details, actions taken, and current state. Do not add headings, bullet points, Markdown, quotes, or information absent from the ticket.",
        },
        { role: "user", content: state },
      ],
    }),
  });
  const summary = data.choices?.[0]?.message?.content?.trim();
  if (!summary || summary.includes("\n")) {
    throw new Error(`Model did not return a single paragraph for ticket ${ticket.id}`);
  }
  return summary;
}

async function updateTicket(ticket, summary) {
  const url = `${TICKETS_API_URL.replace(/\/$/, "")}/${ticket.id}`;
  await fetchJson(url, {
    method: "PATCH",
    headers: ticketHeaders(),
    body: JSON.stringify({ [SUMMARY_FIELD]: summary }),
  });
}

async function main() {
  const payload = await fetchJson(TICKETS_API_URL, { headers: ticketHeaders() });
  const tickets = extractTickets(payload);
  let updated = 0;

  for (const ticket of tickets) {
    try {
      const summary = await summarize(ticket);
      await updateTicket(ticket, summary);
      updated += 1;
      console.log(`Updated ticket ${ticket.id}`);
    } catch (error) {
      console.error(`Failed ticket ${ticket.id}: ${error.message}`);
    }
  }

  if (updated === 0 && tickets.length > 0) {
    process.exitCode = 1;
  }
}

main();
