# Held-out fixture: marketplace operations

A second fixture codebase in a different domain from `support-ops`, written after the skill text was frozen and never used to tune it. It exists so the discovery and implementation numbers have at least one out-of-sample measurement; every result on `support-ops` is a training-set score because the skill's wording was revised from that fixture's failures.

## Method

`fixture/src` is the backend of a peer-to-peer marketplace with fifteen modules. Seven contain a judgment that code is currently faking with a term list, a parsed chat completion, a points heuristic, or a human queue. Eight are deterministic (or a transport helper) and should be left alone. `sites.json` labels every file, and for each opportunity it carries the accepted primitives, an implementation brief, an input shape, the allowed actions, sample inputs, the expected action for the samples whose right answer is not arguable (`null` where it is), and site-specific rubric items.

| File | Opportunity | What the design must handle |
| --- | --- | --- |
| `listings/prohibited.ts` | yes | Term lists for weapons, counterfeits, and recalled goods, so one `noul` per violation (or a `choice` with none), the strike rule in code, and a hold path for uncertain cases |
| `disputes/resolve.ts` | yes | Chat completion parsed into a label, with tracking rules already in code and an amount rule the prompt asks the model to remember; one `choice` with escalate, both rules in code |
| `returns/reason.ts` | yes | Keyword map over a closed set of reasons; `arrived_late` is derivable from the two dates, so it must be decided in code and the dates kept out of state |
| `sellers/onboarding.ts` | yes | Human queue after verification and category checks; the description is judged for a real, permitted business, with review only through a confidence gate |
| `reviews/quality.ts` | yes | Length, photo, and vote points standing in for how informative a review is, so a `score` with concrete levels, placement derived in code, verified-purchase rule in code |
| `messages/offplatform.ts` | yes | Regex and payment-service terms standing in for the intent to move payment or contact off platform, so a `noul` about the fact with the new-account rule and pattern extraction in code |
| `catalog/condition.ts` | yes | Hint lists mapping a description to one of five ordered conditions, so a `score` (or concretely described `choice`), with the comparison to the declared condition in code and the declared value kept out of state |
| `llm/client.ts` | no | Transport helper |
| `orders/eta.ts` | no | Business-day date arithmetic |
| `pricing/fees.ts` | no | Rate table arithmetic |
| `promos/validate.ts` | no | Date, count, and membership checks |
| `inventory/reorder.ts` | no | Moving average and threshold |
| `payouts/schedule.ts` | no | Date arithmetic and grouping |
| `geo/zones.ts` | no | Longest-prefix lookup |
| `auth/ratelimit.ts` | no | Token bucket |

The phases, arms, prompts, sandbox, and judge are the same as for `support-ops`; see `../../README.md`.

## Design notes

The traps are chosen to separate the skill's rules from what a model does with the API reference alone: a judgment that co-occurs (prohibited categories) where a single `choice` loses information; a rule that is currently inside a prompt (the $500 escalation) and should move to code; a label (`arrived_late`) that looks semantic but is date arithmetic; hard rules (verification, verified purchase, new-account block) that should return before the model is called; and numeric inputs (`helpfulVotes`, `hasPhoto`, `amountCents`, dates, the declared condition) that a model should not be asked to weigh.

Expected actions are only set where a reasonable reviewer would not argue: the knife set publishes, the "mirror quality" sneakers are blocked, the $890 camera dispute escalates, the three-week delivery is `arrived_late`, the flickering lamp is `defective`, the ceramics studio is approved, the mislabelled vape shop is rejected, the "runs a half size small" review is featured, the unverified "Great!" is buried, the receipt message is delivered, the "skip the fees" message is warned, the phone number from a day-old account is blocked, the dented box is accepted, and the cracked screen and scratched back are flagged. The others (who is at fault in a torn-lining dispute, whether "wrong colour" is `wrong_item` or `not_as_described`, what to do with boilerplate seller copy or a courier rant with six helpful votes) are left ungraded rather than forcing a label.
