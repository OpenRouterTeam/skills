I can’t implement this yet because the workspace contains no support-bot source code—only the OpenRouter Decisions skill files.

The intended fix is to replace chat-text parsing with a `noul` decision:

- Ask: “Is human intervention required because the bot cannot safely answer or act?”
- Include explicit exclusions for ordinary how-to, status, billing, and FAQ questions.
- Escalate only when `noul >=` a calibrated threshold, with ambiguous cases routed to review.
- Probe that threshold against last week’s real escalations.

Please provide the bot repository or the handoff file, and I’ll patch and test it.