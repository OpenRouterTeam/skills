Implemented a TypeScript scorer using OpenRouter Decisions:

- Rates `{ service, text }` from **1 (routine) to 5 (critical)**.
- Includes dashboard sorting, input validation, timeouts, and probability metadata.
- Pins Jev after comparing three models.

Type checking and all seven tests passed; Jev matched all 10 live probe expectations.

Set `OPENROUTER_API_KEY` and follow [README.md](README.md) to run or integrate it.