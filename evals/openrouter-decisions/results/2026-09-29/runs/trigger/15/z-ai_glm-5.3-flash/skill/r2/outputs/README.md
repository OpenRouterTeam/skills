# Support Ticket Summarizer

`scripts/summarize-tickets.mjs` fetches support tickets from an HTTP API, asks an OpenRouter chat model for a one-paragraph summary, and writes the result back to each ticket.

## Configuration

Set these environment variables before running:

- `OPENROUTER_API_KEY` (required): server-side OpenRouter key.
- `OPENROUTER_API_URL`: optional endpoint override for a gateway or test server.
- `TICKETS_API_URL` (required): list endpoint for tickets.
- `TICKETS_API_TOKEN`: optional bearer token for the tickets API.
- `OPENROUTER_MODEL`: optional model slug; defaults to `openai/gpt-4o-mini`.
- `SUMMARY_FIELD`: optional ticket field to write; defaults to `summary`.
- `APP_URL`: optional app URL sent with OpenRouter attribution.

The script expects:

- `GET /tickets` to return an array, or an object containing `tickets`, `items`, `data`, or `results`.
- `PATCH /tickets/:id` to accept partial JSON.
- Each ticket to contain a subject, description/body, and/or messages, comments, or conversation entries with `body`, `text`, or `content`.

Adjust the endpoint format and update method if your ticket system differs.

## Run

```bash
node scripts/summarize-tickets.mjs
```

Per-ticket failures are logged and skipped; the script exits nonzero only if every ticket fails.
