Implemented a TypeScript module that accepts `{ service, text }` and returns urgency **1–5**, probabilities, and a dashboard sorting score using OpenRouter Decisions.

Includes input validation, timeouts, and sorting that keeps unscored reports visible.

Verified: 6 tests, TypeScript checks, and 10/10 live synthetic probes passed. Setup and integration examples are in `README.md`.