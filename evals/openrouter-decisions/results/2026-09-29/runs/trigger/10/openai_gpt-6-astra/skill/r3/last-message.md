Created a standalone TypeScript ranker:

```ts
const result = await rankTickets(newTicket, openCandidates);
// [{ ticketId, probabilitySameIssue }, ...] in result.ranked
```

It evaluates up to 20 candidates in one OpenRouter Decisions request and sorts independent same-issue probabilities. Multiple tickets can match; all can score low.

The live 20-candidate probe ranked the paraphrase first at **0.96**, versus **0.01–0.11** for others. Tests and type checking passed.

Set `OPENROUTER_API_KEY`, then run `npm run example`. Remove the old overlap cutoff before ranking so paraphrases reach the model. Validate probabilities on historical tickets before choosing an automatic-merge threshold.