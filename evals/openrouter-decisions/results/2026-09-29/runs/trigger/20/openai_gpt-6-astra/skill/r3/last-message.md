Replace the yes/no text parsing with a typed decision and an explicit escalation policy:

- Use OpenRouter Decisions to estimate whether human intervention is required, given the conversation, relevant help articles, and the bot’s available actions.
- Keep mandatory handoffs in code. Routine questions the bot can answer should stay with it.
- Tune the probability threshold against labeled examples, measuring both unnecessary handoffs and missed necessary escalations. Include non-escalated conversations to catch the latter.
- Preserve the existing fallback for API failures and log probabilities plus model version for review.

The workspace contains no bot code or escalation data, so I haven’t changed the application. I need the repository/path and labeled examples to implement and validate this.