# Ticket summarizer

Generate a one-paragraph LLM summary for every ticket in a JSON array and store it in a ticket field.

```bash
export OPENROUTER_API_KEY=...
python3 scripts/summarize_tickets.py tickets.json
```

Each ticket must have at least one of `id`, `subject`, `description`, or `body`. Tickets with an existing summary field are skipped. Progress is saved after every successful API call using an atomic file replacement.

Options:

- `--field summary`: destination field.
- `--model openai/gpt-4o-mini`: OpenRouter model ID.
- `--limit 10`: process a bounded batch.
- `--dry-run`: print summaries without writing the file.

Run tests with `python3 -m pytest -q scripts/test_summarize_tickets.py`.
