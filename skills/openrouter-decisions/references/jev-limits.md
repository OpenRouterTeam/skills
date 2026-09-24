# Jev 1.13 limits and the code-side pattern for each

Source: TypeSafe's model jaggedness page for Jev 1.13 (https://docs.typesafe.ai/model-jaggedness/jev-1.13.md). Each row names a limit, the symptom, and what to do instead. The rule underneath all of them: the model judges, code computes.

| Limit | What goes wrong | Do instead |
| --- | --- | --- |
| Literal reading | Loose wording such as "is this about billing" matches broadly. Presence questions ignore negation, so "does it mention breaking changes" reads as true for "No breaking changes". | Write the exact condition and ask for the meaning. Say "the customer states they were charged more than once" instead of "billing problem". |
| Math and numbers | Cannot add, compare magnitudes, or judge closeness of numeric values such as hex colors, RGB triples, or amounts. Semantic forms beat numeric ones. | Compute in code, then pass the result or a named bucket (`over_limit: true`, `color_name: "red"`). |
| Score used as a number | The `score` expectation is not calibrated between levels. Interpolating a magnitude from it is unreliable. | Use `score` to pick a level or pass a threshold. Never reconstruct a quantity from it. |
| Counting | Cannot count items or occurrences reliably. | Ask one `noul` per item (`Is items[3] a fruit?`) and count the yeses in code. |
| Date and time comparison | Reads dates as text. Which comes first, how far apart, and inside-a-window are unreliable, and worse with mixed formats or relative references. | Extract each date part as a `choice` over its closed set (month, day, year, with `not_stated`), assemble and compare in code. |
| Indirection | Double negatives and property-of-a-property questions lose accuracy. | Ask directly, in one hop, and name the state field the question is about. |
| Large state with irrelevant detail | Accuracy drops as unrelated content grows, and it becomes hard to tell which part caused a wrong answer. | Filter and retrieve in code before the call. If you cannot, run a relevance `noul` first and send only what passes. |
| Adversarial content | State is treated as data, not as hostile. Injected instructions or text that argues for its own classification can move the answer. | Make criteria explicit about what counts, test with adversarial inputs, and keep a code-side or human fallback for high-stakes decisions. |
| Contradictory instructions and criteria | When `instructions` and `criteria` pull apart (a `noul` whose `true` means no), answers degrade. | Write criteria as an extension of the instructions, in plain language a non-expert would read the same way. |
| Structural invariants | A `noul` and a yes/no `choice` on the same question give different numbers. `P(refund)` and `1 - P(not_refund)` from two `noul`s do not agree. | Ask each decision one way, tune its threshold on its own outputs, and enforce identities in code rather than expecting them from the model. |
| Generation | Not trained to produce text or values. Chaining choices to spell out an answer is slow and poor. | When the answer space is bounded, offer it as `choice` options. Use regex or a generative model to produce candidates, then let Jev pick. |

Avoid, in every question:

- Asking for something code can compute exactly.
- Hiding several judgments inside one question.
- Multi-hop reasoning tasks.
- More state than the question needs.
