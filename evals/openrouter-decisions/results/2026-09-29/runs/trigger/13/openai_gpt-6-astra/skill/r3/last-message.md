Added [email-validator.mjs](/home/ubuntu/repos/skills/evals/openrouter-decisions/results/2026-09-29/runs/trigger/13/openai_gpt-6-astra/skill/r3/workspace/email-validator.mjs):

```js
export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

Checks basic format and returns a boolean; it doesn’t verify mailbox existence. Verified with valid and invalid inputs.