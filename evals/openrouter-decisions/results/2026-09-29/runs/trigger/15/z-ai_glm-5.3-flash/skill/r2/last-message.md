Implemented a reusable ticket summarizer and validated it end-to-end against a mock ticket API and OpenRouter-compatible endpoint.

- Added `scripts/summarize-tickets.mjs:1` to fetch tickets, generate exactly one concise paragraph per ticket via OpenRouter chat completions, and `PATCH` the summary onto each ticket.
- Supports per-ticket continuation and failure logging so one bad ticket doesn’t stop the run.
- Documents required env vars and API expectations in `README.md:1`.
- Verified the full flow with a mock server; the ticket summary was correctly written back via `PATCH`.