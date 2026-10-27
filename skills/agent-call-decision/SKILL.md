---
name: agent-call-decision
license: MIT
description: >
  Build with System One models (also called decision models) such as Jev through OpenRouter's System One API, `POST https://openrouter.ai/api/v1/systemone`, which answers typed questions about text, images, and application state with calibrated probabilities. Use when building, reviewing, or debugging code that calls System One or the TypeSafe SDK through OpenRouter; when writing its questions or state; when locating something in an image with a Box question; when replacing an LLM prompt-and-parse step, keyword matching, or a brittle heuristic with a typed question; or when brainstorming where programmable common sense fits in an app.
---

# Call decisions through OpenRouter's System One API

A **System One model** answers typed questions about state your application supplies. State is the text, images, and application data your code sends with a request. **Jev** from TypeSafe was the first; OpenRouter serves it and every other decision model in its catalog through the **System One API**. A model can answer a Choice among options, a Noul (the probability that a statement is true), a Score on levels you describe, or, on Jev 1.14, a Box that locates something in an image. Each answer comes back as typed data with calibrated probabilities, for your code to use.

The rest of this skill is guidance: patterns that tend to produce reliable integrations. None of it is absolute. Models change, applications differ, and edge cases exist. When a situation calls for something else, test the alternative and use your judgment.

## Judgments from the model, decisions in code

Integrations tend to work best when the model makes the judgments and code decides what to do with them. Think of each decision as a **truth table**. The model supplies the inputs, such as "Does the customer sound frustrated?" or "Which product is the message about?". Code holds the logic that maps those inputs to an action.

A question that asks the model to make the decision, such as "Should this ticket be escalated?" or "What should the agent do next?", usually means the question is at the wrong layer. Instead, break the decision into the judgments it depends on, and write the decision itself in code, where it's visible and testable. Writing out the table often shows gaps in the business logic too. A combination of judgments with no defined outcome is a design question about the system, and it is best settled in code.

## Call the System One API

- **Endpoint.** `POST https://openrouter.ai/api/v1/systemone` with `Authorization: Bearer $OPENROUTER_API_KEY` and a JSON body of `model`, `state`, and `questions`. Optional: `session_id` and `trace` for observability grouping, `user` for per-end-user attribution, `provider` for routing preferences.
- **Same contract as the Decisions API.** `POST https://openrouter.ai/api/alpha/decisions` takes the same body and returns the same answers. Use it from the OpenRouter TypeScript, Python, or Go SDK (`client.alpha.decisions.create`). Use the System One path from plain HTTP or the TypeSafe SDK.
- **Model IDs.** `model` is required. A bare TypeSafe ID maps onto OpenRouter's `typesafe/` namespace (`jev-1.14` becomes `typesafe/jev-1.14`, `jev-latest` becomes the alias `~typesafe/jev-latest`), and an ID with a vendor prefix, such as `perplexity/pplx-decider-flash-v1.2`, is used as-is. List every decision model with `curl -s "https://openrouter.ai/api/v1/models?output_modalities=decisions"`; add `&input_modalities=image` for models that read images. Pin a versioned ID in one config value, not an alias such as `jev-latest`, because thresholds belong to the build you probed. The response `model` field is the exact build that answered (`typesafe/jev-1.14-20261014`); log it with every stored answer.
- **TypeSafe SDK.** An existing `@typesafe-ai/sdk` or `typesafe_sdk` client works unchanged with `baseURL: 'https://openrouter.ai/api'` (`base_url` in Python) and an OpenRouter key as `apiKey`, or with `TYPESAFE_BASE_URL=https://openrouter.ai/api` and `TYPESAFE_API_KEY=<OpenRouter key>`. The SDK's `client.models.list()` does not work against OpenRouter; read the Models API above instead.
- **Response.** `answers` holds one typed answer per question key, plus `id`, `model`, `provider`, and `usage` (`input_tokens`, `output_tokens`, and `cost` in USD). Every answer carries `type`. Check it before reading fields, and treat a missing key or an unexpected `type` as an error, not a default.

```bash
curl -s https://openrouter.ai/api/v1/systemone \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "typesafe/jev-1.14",
    "state": { "message": "I was charged twice for my subscription." },
    "questions": {
      "refund": { "type": "noul", "instructions": "Is the customer in `message` asking for money back?" },
      "team": {
        "type": "choice",
        "instructions": "Which team should handle `message`?",
        "criteria": { "billing": "Charges and refunds", "technical": "Bugs and outages" }
      }
    }
  }'
```

| Question `type` | Request fields | Answer fields |
| --- | --- | --- |
| `noul` | `instructions`, optional `criteria` with exactly `true` and `false` | `noul`, the probability of yes |
| `choice` | `instructions`, `criteria` mapping option name to description (or `null`) | `choice`, `probabilities` per option, `confidence` |
| `score` | `instructions`, `criteria` as an ordered array, lowest level first | `score` (probability-weighted position), `legend` mapping `"0"`, `"1"`, ... to levels, `probabilities` per level, `confidence` |
| `box` | `instructions` describing the target and the image it is in; no `criteria` | `box` with `top`, `bottom`, `left`, `right` as fractions of the image measured from the top-left corner, `confidence` |

`instructions` and every criterion accept a string or a JSON structure. Read `probabilities`, `confidence`, and `legend` through a presence check; the schema marks them optional.

### Images and Box

- **Send images inline.** Put each image in the `state` array as `{ "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }`, next to plain-string text items. Jev also reads image parts nested inside `state` objects, inside an array-valued `instructions`, and inside criteria; other models read images only in the top-level `state` array.
- **TypeSafe's `assets` map does not apply.** OpenRouter ignores a top-level `assets` map with named references, and rejects a top-level `images` field with a `400`, so an image sent either way never reaches the model. Remote `http(s)` URLs are not fetched. Jev accepts only PNG and JPEG, each 256 to 1,568 pixels per side, with EXIF orientation not applied. No `TypeSafe-Danger-Zone-Images` header is needed.
- **Box is Jev 1.14 only.** `typesafe/jev-1.14` and `~typesafe/jev-latest` answer it; Jev 1.13 rejects it with a `400` and no other model supports it. A Box always returns four edges, even when the target is absent or the state has no image, so pair it with a Noul that asks whether the target is there.
- Images and Box are early features whose request format, answers, and limits can change between releases. Check the live docs before relying on a detail.

## Live docs

The live docs are the source of truth for request syntax, question types, limits, and current model behavior. Read the relevant pages as part of the task.

- OpenRouter is the source of truth for the endpoint, model IDs, image format, and limits: the [System One API reference](https://openrouter.ai/docs/api/api-reference/systemone/submit-a-system-one-request.md), the [TypeSafe SDK guide](https://openrouter.ai/docs/guides/community/typesafe-sdk.md), the [Jev hub](https://openrouter.ai/docs/guides/community/jev.md), [multimodal decisions](https://openrouter.ai/docs/guides/community/multimodal-decisions.md), and the [docs index](https://openrouter.ai/docs/llms.txt). Append `.md` to a docs page path to get it as Markdown.
- TypeSafe's docs are the source for System One concepts and question design: the [documentation index](https://docs.typesafe.ai/llms.txt), [primitives](https://docs.typesafe.ai/go/primitives.md), [structured instructions and criteria](https://docs.typesafe.ai/go/advanced.md), [how to build with TypeSafe](https://docs.typesafe.ai/go/how-to-build.md), [patterns](https://docs.typesafe.ai/go/patterns.md), [cookbooks](https://docs.typesafe.ai/go/cookbooks.md), and Jev's known weak spots on the [jaggedness page](https://docs.typesafe.ai/go/jaggedness.md). Their request examples target TypeSafe's own API, so translate them: OpenRouter's base URL and key, a `model` on every request, and image parts in place of `assets` references.

If you can't reach the live docs, use the installed SDK's types or local docs, and tell the user you did. Leave out details that depend on the version rather than guessing them.

## Workflow

1. **Start from the decision logic.** Begin with what the application will show, select, change, or hand off. Sketch the truth table or rules that decide it, and list the inputs they need. Inputs that need an understanding of language or images make good questions. Arithmetic, dates, exact lookups, and policy usually belong in code. Aim for every question to feed the table, and give every combination of answers an outcome, including the case where a Noul lands between your thresholds. If code alone can already make the decision reliably, tell the user.
2. **Keep all question wording in one place.** Questions, options, criteria, and thresholds are the parts of an integration people audit and edit most. Keeping them together in one module makes that easier. [Design the state](#design-the-state) and [Write the questions](#write-the-questions) describe what tends to work.
3. **Pick and pin a model.** Start from the live catalog, not memory. Check that the model reads the modalities your state carries and that the state fits its `context_length`, and use `typesafe/jev-1.14` when you need Box. When more than one model fits, send the same probe set to each and compare answers, latency, and `usage.cost`.
4. **Probe the live API**: send test requests as described in [Test with the live API](#test-with-the-live-api). Use representative cases, hard cases, and negative cases. Keep going until the application behaves as intended.
5. **Integrate.** A few habits help here. Expose or log the exact request payload and the response `model`. When a call to the API fails, surface it as an error, not as an answer; for example, don't treat a failed call as a "no". Keep the OpenRouter API key on the server.

If the user's request is open-ended, offer the few directions from [Cookbooks](#cookbooks) that best serve their goal, and recommend one. If the request is concrete, build it.

## Design the state

A useful check for any question is the **human test**: could a smart person, shown only this state and this question, answer quickly by intuition? When a question fails the test, the fix is usually in the state, not in the wording.

- **Give what a person would look at.** That means who sent each message, the full thread rather than a truncated last line, names rather than raw IDs or @-mention markup, and the item the question is about rather than the whole catalogue. State facts your code already knows, such as "all messages in `replies` were sent after the refund was issued", rather than leaving the model to work them out.
- **Name fields for what they hold.** Put each piece of context in a named JSON field (`ticket`, `customer_tier`, `photo`) so questions can point at it by its exact path in backticks, such as `` `ticket.messages[0].text` ``.
- **Filter in code first.** Accuracy drops as unrelated content grows, and it becomes hard to tell which part caused a wrong answer. Send only what the questions read.
- **Consider leaving out what no person could judge**, such as a guess about the future or a matter experts dispute. The model's answer there tends to be noise, and code will treat that noise as signal.

## Write the questions

Break complex judgments or decisions into their parts, and combine the answers in code with weighted sums, boolean logic, thresholds, or other heuristics to reach the final decision. For example, rather than asking "Is this fraud?" or "Is this spam?", ask the set of atomic questions about what might make something fraud or spam. Each question tends to work best when it asks for **one judgment** that a person could make at a glance.

- **Ask the concrete, observable thing.** Aim for something a person could point to: "Is a SQL query built by string concatenation here?" rather than "Are there SQL injection risks?".
- **One judgment per question; beware the "or".** Two conditions joined by "or" or "and" usually work better as two questions. Likewise, a list of rules usually works better as one question per rule.
- **Anchor intent to the goal.** When the judgment is about what someone wants, it helps to name their goal: "Which of these files does the user want copied?" rather than "Which of these names the main input?".
- **Name the subject directly.** "Where is the coffee mug in `photo`?" reads better than "Where is `target` in `photo`?" with the target defined somewhere else. Context that only one question needs, including an image on Jev, usually fits best in that question's instructions or its criteria. Context that many questions share can go in the state once, and each question can refer to it by its exact path in backticks. When you ask the same question about many items, it usually works better to put each item into its own question than to give an ID the model has to look up in a shared list.
- **Each question is answered on its own.** Questions in a request can't see each other or each other's answers. Any context a question relies on belongs in the state or in that question.
- **Write plainly.** A question isn't an LLM prompt. Preambles, "consider X, Y, and Z" lists, and output-format instructions add noise. Descriptions of the options belong in the criteria, not in the question. Phrase the question so that a true answer means yes. Watch for double negatives, and for presuppositions such as "the next step".
- **Name the case that causes confusion.** If answers keep mixing up two outcomes, say in the criteria what separates them, using the specific case. For example, for "Is this a refund request?", note that a question about the refund policy is not a request. A vague exclusion such as "not other kinds of message" helps less, and can draw attention to the wrong answer.

### Criteria

- **Ask about the null case separately.** A Box always returns a location and a Choice always picks an option, even when nothing fits. Pair either one with a Noul in the same request that asks whether anything fits ("Is there a coffee mug in `photo`?", "Does `message` name any of our products?"), so code can tell when nothing does. As of Jev 1.14, this companion Noul usually works better than a "none of the above" option.
- **Option names are sent to the model; question IDs are not.** Names that describe the content (`refund_request`, `shipping_delay`) help the model. Positional names (`A`, `left`, `option_1`) give it nothing meaningful to go on and can bias the answer.
- **Keep options distinct and concrete.** Wording that options share with each other, or with the input, can pull probability toward those options. An option that covers several meanings is often worth splitting, because its probability can't tell code which meaning applied. Direction and magnitude usually work better as separate questions, so that the answer to one doesn't get mixed into the other.
- **Describe each Score level as a situation.** Each level should make sense when read on its own: "The customer mentions a minor inconvenience" rather than "More upset than the previous level".
- **Describe a Noul's `false` criterion as a concrete situation**, such as "the package arrived on time", rather than as "not late".
- **Use a Noul per statement when more than one can be true.** A Choice picks one option, so a message that is both a refund request and a complaint forces it to split probability between the two. Separate Nouls let each one be true on its own.
- **Describe a Box target by what sets it apart.** When the image holds several similar objects, name the feature that singles out the target ("the red circle in the lower right of `photo`"), and check the returned edges on images with distractors, not only on images with one object.

## Compose requests

**Bundle questions that share state.** A handy heuristic: if two calls would send the same state with different questions, they can likely be one call. Questions are cheap and run in parallel, and the state is read and paid for once. See [parallel questions](https://docs.typesafe.ai/cookbooks/parallel_questions.md).

**Ask speculatively**, meaning ask a question before you know whether you'll need its answer. A question that only matters in some cases can go in the same request as the question that identifies the case. Ask "Is `order` a return request?" and "Which item in `order.items` is being returned?" together, and have code read the second answer only when the first is yes. The second question doesn't need an "if" clause, because code handles the condition. See [speculative fan-out](https://docs.typesafe.ai/patterns/fan-out.md).

A second request is usually worth it when:

- code needs an answer to build the next state, fetch evidence, or choose the next options;
- a state field needed for one question measurably misleads another;
- different sets of questions need to be cached or versioned separately.

## Read the answers

### Confidence is rarely the gate

Naive implementations often use an answer's `confidence` as the check that decides whether code acts. Confidence measures how concentrated an answer's probability distribution is, which is not the same as how likely the answer is to be correct. Think about what the probabilities should look like in your use case; another calculation over them may suit it better.

### Probabilities and thresholds

- **A probability is the likelihood that an answer is correct.** The model isn't a calculator for probability problems. Ask it for judgments, and do any math on odds or probabilities in code. A Noul near 0.5 usually means the state doesn't settle the question.
- **The top answer is a good default**: the Choice's top option, or the Score's position.
- **0.7 and 0.3 make good starting thresholds for a Noul**: above 0.7 reads as yes, below 0.3 as no, and the band between means the question isn't settled, which can get its own row in the truth table. Adjust them when the application calls for it, and be wary of over-fitting them to a handful of test cases.
- **Look at Score distributions.** The Score's position can get pulled toward the middle and hide two-peaked answers, so look at the level probabilities before deciding which value your code reads.
- **Thresholds don't carry between models.** Probabilities differ between models and builds on the same question, so set thresholds again after any model change.

## Test with the live API

Sending test requests to the live API is a great way to test questions against your data. Ask the user for permission first. Get a budget for experimentation (decision models are very inexpensive, and `usage.cost` reports the spend per call), disclose what data will be sent (point out any personal or private data), and say that their `OPENROUTER_API_KEY` will be used.

- Start with a few representative cases, plus hard ones and some whose answer is "no" or "nothing fits".
- Compare wordings by sending each variant as a separate question in one request, over the same state.
- Read individual answers, not only aggregates.
- Keep the exact request payload for each case so any result can be rerun.
- Check each change against cases you didn't use while tuning.

Make sure any agent that sends test requests has network access to `openrouter.ai`.

### When an answer looks wrong

Check these, in this order:

1. the payload as actually sent, including that every image is an inline `image_url` part rather than an `assets` reference;
2. the state, against the human test;
3. the options and candidates: is the right answer among them?
4. the scope of the questions: can each one be broken down into smaller judgments?
5. the wording.

If a clear question with complete state still gets an answer you're confident is wrong, check the jaggedness page for the model you're using, or the vendor's limits page for another model. It lists known weak spots and how to work around them. In the meantime, work out an alternative approach with the user that avoids the weak spot.

### Yellow flags

Typically, a good change is one that makes the definition clearer or improves the state. Check each change on cases you didn't tune on. Wording written to produce a particular value is **prompt gymnastics**, and it tends to break on new inputs and on the next model version. Some yellow flags:

- criteria that name specific test items, or that gain a clause for each failing case;
- caveats that explain away a model quirk;
- thresholds fitted to particular cases;
- tests that assert an exact probability;
- code that quietly overrides answers.

The structural fix is usually better state, a separate question, or code.

## Cookbooks

Each of these starting points combines questions to serve one goal. Ideas outside this list are welcome. TypeSafe's cookbooks call TypeSafe's API directly; translate their requests as described in [Live docs](#live-docs).

- **Route and fill arguments.** One request identifies what the user is asking for and which values go in each argument. Code then calls the handler. See [function calling](https://docs.typesafe.ai/cookbooks/function_calling.md) and [intent routing](https://docs.typesafe.ai/patterns/intent-routing.md).
- **Gate agent actions.** Check each risky tool call or permission prompt against what the user asked for, run the safe ones, and pause only on the ambiguous ones. See [gate agent tool calls](https://openrouter.ai/docs/cookbook/building-agents/gate-tool-calls-with-jev.md) and [auto-approve permission prompts](https://openrouter.ai/docs/cookbook/coding-agents/auto-approve-permission-prompts-with-jev.md).
- **Select instead of generate.** Code finds candidate values or spans of text, the model picks the intended one, and code copies or normalizes it. See [value extraction](https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook.md), [date extraction](https://docs.typesafe.ai/cookbooks/date_extraction_cookbook.md), and [structure recovery](https://docs.typesafe.ai/cookbooks/autoformat.md).
- **Find and judge evidence.** Retrieve candidates and ask how relevant each one is. See [line-by-line search](https://docs.typesafe.ai/cookbooks/semantic_find.md), [re-ranking](https://docs.typesafe.ai/cookbooks/rerank_typesafe.md), and [classifying RAG passages](https://docs.typesafe.ai/cookbooks/classifying_rag_passages.md).
- **Turn answers into data.** Score each dimension once, then let code or users change the weights and views. If you have labeled outcomes, the answers can become features for a model. See [composite scoring](https://docs.typesafe.ai/patterns/composite-scoring.md), [feature discovery](https://docs.typesafe.ai/cookbooks/autoresearch_feature_discovery.md), and [classify and tag text at scale](https://openrouter.ai/docs/cookbook/evaluate-and-optimize/jev-classification.md).
- **Verify and escalate.** Check claims or fields against their evidence, and send the cases that fail to a person or a reasoning model. See [citation checks](https://docs.typesafe.ai/cookbooks/citation_check.md), [extraction cascades](https://docs.typesafe.ai/cookbooks/sde_cascade.md), and [a Jev-verified cascade](https://openrouter.ai/docs/cookbook/evaluate-and-optimize/jev-verified-cascade.md).

Both TypeSafe's [cookbooks index](https://docs.typesafe.ai/go/cookbooks.md) and OpenRouter's [Jev hub](https://openrouter.ai/docs/guides/community/jev.md) add well-tested patterns over time. It's a good idea to check them for one that fits the problem you're solving.
