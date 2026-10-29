# Question design

Patterns that tend to produce reliable decision-model integrations, from TypeSafe's System One guidance. None of it is absolute: models change and applications differ, so when a situation calls for something else, probe the alternative.

## Decisions as truth tables

The model supplies the inputs to a decision ("Does the customer sound frustrated?", "Which product is the message about?") and code holds the table that maps them to an action. A question that asks the model to make the decision ("Should this ticket be escalated?", "What should the agent do next?") is at the wrong layer: break it into the judgments it depends on and write the decision in code, where it is visible and testable. Give every combination of answers an outcome, including a `noul` that lands between your thresholds. A combination with no defined outcome is a design question about the system, settled in code. Keep questions, options, criteria, and thresholds together in one module, since they are the parts people audit and edit most.

## The human test

Could a smart person, shown only this state and this question, answer quickly by intuition? When a question fails the test, the fix is usually in the state, not the wording.

- Give what a person would look at: who sent each message, the full thread rather than a truncated last line, names rather than raw IDs or @-mention markup, and the item the question is about rather than the whole catalogue.
- State facts code already knows ("all messages in `replies` were sent after the refund was issued") rather than leaving the model to work them out.
- Leave out what no person could judge, such as a guess about the future or a matter experts dispute. The answer there is noise that code will treat as signal.

## Wording

- **Atomic.** Rather than "Is this fraud?", ask the set of questions about what makes something fraud and combine them in code. Two conditions joined by "or" or "and" are usually two questions, and a list of rules is one question per rule.
- **Concrete and observable.** "Is a SQL query built by string concatenation here?" rather than "Are there SQL injection risks?".
- **Anchor intent to the goal.** "Which of these files does the user want copied?" rather than "Which of these names the main input?".
- **Name the subject directly.** "Where is the coffee mug in `photo`?" rather than "Where is `target` in `photo`?" with the target defined elsewhere. Context only one question needs goes in that question's instructions or criteria. When asking the same question about many items, give each item its own question rather than an ID the model has to look up in a shared list.
- **Each question is answered on its own.** Questions in a request cannot see each other or each other's answers.
- **Write plainly.** A question is not an LLM prompt. Preambles, "consider X, Y, and Z" lists, and output-format instructions add noise. Phrase it so a true answer means yes, and watch for presuppositions such as "the next step".
- **Name the case that causes confusion.** If answers mix up two outcomes, say in the criteria what separates them using the specific case ("a question about the refund policy is not a refund request"). A vague exclusion such as "not other kinds of message" helps less and can draw attention to the wrong answer.

## Criteria

- **Ask about the null case with a companion `noul`.** A `choice` always picks an option and a `box` always returns edges, even when nothing fits. Pair either with a `noul` in the same request that asks whether anything fits ("Does `message` name any of our products?", "Is there a coffee mug in `photo`?"). On Jev 1.14 this works better than a `none` option. On other models, probe both.
- **Option names are sent to the model, question keys are not.** Descriptive names (`refund_request`, `shipping_delay`) help. Positional names (`A`, `left`, `option_1`) give it nothing and can bias the answer.
- **Keep options distinct and concrete.** Wording options share with each other or with the input pulls probability toward them. Split an option that covers several meanings, and ask direction and magnitude as separate questions.
- **Describe each `score` level and each `noul` `false` criterion as a situation that stands alone**: "The customer mentions a minor inconvenience", "The package arrived on time", never "More upset than the previous level" or "Not late".
- **Describe a `box` target by what sets it apart.** With several similar objects in the image, name the distinguishing feature ("the red circle in the lower right of `photo`"), and probe images with distractors, not only images with one object.

## Composing requests

Questions sharing state go in one request: they run in parallel and the state is paid for once. Ask speculatively: a question that matters only in some cases goes in the same request as the question that identifies the case ("Is `order` a return request?" with "Which item in `order.items` is being returned?"), and code reads the second only when the first is yes, so the second needs no "if" clause. A second request is worth it when code needs an answer to build the next state or options, when a field one question needs measurably misleads another, or when question sets need separate caching or versioning.

## Reading answers

- Do any math on probabilities in code. A `noul` near 0.5 usually means the state does not settle the question.
- With a fallback outcome available, 0.7 and 0.3 are reasonable starting `noul` gates: above reads as yes, below as no, and the band between is its own row in the truth table. Move them from probe results, without over-fitting to a handful of cases.
- A `score` position can be pulled toward the middle and hide a two-peaked answer, so read the level `probabilities` before deciding what code reads.
- `confidence` is how concentrated a distribution is, not whether the answer is correct. It is rarely the right gate.

## Probing

Compare wordings by sending each variant as a separate question in one request over the same state. Read individual answers, not only aggregates, keep each exact payload so it can be rerun, and check every change against cases you did not tune on.

When an answer looks wrong, check in this order:

1. The payload as actually sent, including that every image is an inline `image_url` part.
2. The state, against the human test.
3. The options and candidates: is the right answer among them?
4. The scope: can the question be broken into smaller judgments?
5. The wording.

If a clear question with complete state is still confidently wrong, read the vendor's limits page (Jev's is the [jaggedness page](https://docs.typesafe.ai/go/jaggedness.md)) and [decision-model-limits.md](decision-model-limits.md), and work out an approach that avoids the weak spot.

## Yellow flags

Wording written to produce a particular value is prompt gymnastics and breaks on new inputs and the next model build. The structural fix is better state, a separate question, or code. Watch for:

- criteria that name specific test items, or gain a clause per failing case;
- caveats that explain away a model quirk;
- thresholds fitted to particular cases;
- tests that assert an exact probability;
- code that quietly overrides answers.

## Cookbooks

TypeSafe's cookbooks call TypeSafe's own API. Translate them to OpenRouter's base URL and key, and a `model` on every request. Their `assets` image references work on OpenRouter unchanged.

- **Route and fill arguments.** One request identifies the intent and the value for each argument, and code calls the handler: [function calling](https://docs.typesafe.ai/cookbooks/function_calling.md), [intent routing](https://docs.typesafe.ai/patterns/intent-routing.md).
- **Gate agent actions.** Check each risky tool call or permission prompt against what the user asked for and pause only on the ambiguous ones: [gate agent tool calls](https://openrouter.ai/docs/cookbook/building-agents/gate-tool-calls-with-jev.md), [auto-approve permission prompts](https://openrouter.ai/docs/cookbook/coding-agents/auto-approve-permission-prompts-with-jev.md).
- **Select instead of generate.** Code finds candidate values or spans, the model picks the intended one, and code normalizes it: [value extraction](https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook.md), [date extraction](https://docs.typesafe.ai/cookbooks/date_extraction_cookbook.md), [structure recovery](https://docs.typesafe.ai/cookbooks/autoformat.md).
- **Find and judge evidence.** Retrieve candidates and ask how relevant each one is: [line-by-line search](https://docs.typesafe.ai/cookbooks/semantic_find.md), [re-ranking](https://docs.typesafe.ai/cookbooks/rerank_typesafe.md), [classifying RAG passages](https://docs.typesafe.ai/cookbooks/classifying_rag_passages.md).
- **Turn answers into data.** Score each dimension once and let code or users change the weights: [composite scoring](https://docs.typesafe.ai/patterns/composite-scoring.md), [feature discovery](https://docs.typesafe.ai/cookbooks/autoresearch_feature_discovery.md), [classify and tag text at scale](https://openrouter.ai/docs/cookbook/evaluate-and-optimize/jev-classification.md).
- **Verify and escalate.** Check claims or fields against their evidence and send failures to a person or a reasoning model: [citation checks](https://docs.typesafe.ai/cookbooks/citation_check.md), [extraction cascades](https://docs.typesafe.ai/cookbooks/sde_cascade.md), [a Jev-verified cascade](https://openrouter.ai/docs/cookbook/evaluate-and-optimize/jev-verified-cascade.md).

More patterns land over time in TypeSafe's [cookbooks index](https://docs.typesafe.ai/go/cookbooks.md), [patterns](https://docs.typesafe.ai/go/patterns.md), and OpenRouter's [Jev hub](https://openrouter.ai/docs/guides/community/jev.md).
