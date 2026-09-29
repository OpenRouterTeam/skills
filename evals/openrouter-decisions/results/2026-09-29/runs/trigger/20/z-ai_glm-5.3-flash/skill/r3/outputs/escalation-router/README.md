# Escalation Router

Replaces the chat-completion `yes` string check with a Decisions API `noul` question: whether the bot can complete a useful reply itself.

## Routing

- `P(can answer) >= 0.8` — answer.
- `0.2 < P(can answer) < 0.8` — uncertain review queue.
- `P(can answer) <= 0.2` — hand off to a human.

Thresholds are named in `gates.ts`. Before real probing they are conservative defaults chosen so a near-boundary ticket is reviewed rather than silently answered or handed off.

## Required input

Pass only the material a reviewer or answerer needs: conversation, relevant retrieved knowledge, account facts, and the bot's permissions. Do not include unrelated content or code-computed booleans.

Example state:

```json
{
  "conversation": "...",
  "knowledge": "...",
  "account": { "plan": "enterprise", "billing_status": "active" },
  "bot_permissions": ["read_order", "provide_order_status"]
}
```

Call `routeEscalation(state)` from the routing step. Set `DECISION_MODEL` to a pinned `canonical_slug` from the live Decisions catalog.
