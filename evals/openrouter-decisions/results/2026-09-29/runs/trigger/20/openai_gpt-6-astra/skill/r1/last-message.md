Replace the yes/no text check with a typed probability from OpenRouter’s Decisions API, judged against the bot’s actual knowledge, tools, and handoff policy.

The change should:

- Keep mandatory handoffs enforced in code.
- Distinguish cases requiring a human from questions the bot can answer or clarify.
- Tune the escalation threshold against reviewed tickets, tracking both unnecessary handoffs and missed necessary escalations.
- Preserve a fallback for uncertain decisions and API failures.

This workspace contains no bot code or escalation records, so I haven’t changed the application. Where can I access the repository, last week’s reviewed escalations, and the mandatory handoff rules?