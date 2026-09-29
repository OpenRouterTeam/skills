**Ticket Summarizer**
- Added a standalone CLI that reads a JSON ticket array, calls OpenRouter, generates one paragraph per ticket, and atomically stores it in the chosen field.
- Supports `--field`, `--model`, `--limit`, and `--dry-run`; tickets with existing summaries are skipped.
- Added usage documentation in `README.md:1`.
- CLI implementation: `scripts/summarize_tickets.py:1`.
- Persistence and ticket-loading test passes: `scripts/test_summarize_tickets.py:1`.

Usage:
```bash
export OPENROUTER_API_KEY=...
python3 scripts/summarize_tickets.py tickets.json
```