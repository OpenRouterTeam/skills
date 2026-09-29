Added a TypeScript guard and agent wrapper using OpenRouter Decisions. It returns an injection probability, blocks at ≥0.5, and blocks execution on errors or timeouts.

Eight tests and 11 live probe cases passed. Observed model latency: 130–292 ms.

No agent code existed here; connect the wrapper using [README.md](./README.md). Refund tools still need independent authorization checks.