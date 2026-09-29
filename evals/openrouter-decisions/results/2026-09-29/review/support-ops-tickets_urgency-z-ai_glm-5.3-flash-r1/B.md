# support-ops-tickets_urgency-z-ai_glm-5.3-flash-r1

Site: `src/tickets/urgency.ts`

Brief given to both authors:

> Replace the chat-completion call and regex parsing in rateUrgency() with a decision model, keeping the same 1 to 5 urgency output and the existing rule that free-plan tickets never rate 5.

## Candidate B

### Design

```json
{
  "questions": {
    "urgency": {
      "type": "score",
      "instructions": "Rate the urgency of this support ticket. Judge how urgently the reported problem needs attention based on what the customer describes: operational impact, revenue impact, security exposure, and how blocked the customer is. A routine question or cosmetic issue is low urgency; a production outage, ongoing revenue loss, or a security incident is maximum urgency.",
      "criteria": [
        "No rush: a general question, minor cosmetic glitch, or nice-to-have request that can wait for the next regular cycle.",
        "Low urgency: a real annoyance or degraded experience, but there is a workaround and nothing important is blocked.",
        "Moderate urgency: meaningful functionality is impaired or partially blocked, but operations continue and losses are limited.",
        "High urgency: significant work is blocked or failing for the customer today, with real cost accumulating, though some parts still operate.",
        "Maximum urgency: production is down, revenue is actively being lost, or there is an active security incident happening right now."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "\n// Only what the urgency question reads; plan/id feed code-side rules, not the model.\nreturn {\n  subject: String(input.subject || \"\").slice(0, 2000),\n  body: String(input.body || \"\").slice(0, 8000)\n};\n",
  "decide_js": "\n// Map the score answer to a discrete 1-5 level, then apply code-side rules.\nvar u = answers.urgency;\nvar level = null;\n\n// Primary: pick the level with the highest probability (criteria are ordered lowest-first,\n// so legend indices \"0\"..\"4\" correspond to levels 1..5).\nif (u && u.probabilities) {\n  var vals = [];\n  var ok = true;\n  for (var k = 0; k < 5; k++) {\n    var v = u.probabilities[String(k)];\n    if (typeof v === \"number\") vals.push(v);\n    else { ok = false; break; }\n  }\n  if (ok) {\n    var bi = 0;\n    for (var i = 1; i < 5; i++) if (vals[i] > vals[bi]) bi = i;\n    level = bi + 1;\n  }\n}\n\n// Fallback: the probability-weighted position, interpreted as 0-indexed over the criteria.\nif (level === null && u && typeof u.score === \"number\") {\n  level = Math.round(u.score) + 1;\n}\n\n// Last resort mirrors the old parse-miss default.\nif (level === null || !(level >= 1 && level <= 5)) level = 3;\n\n// Existing business rule: free-plan tickets never rate 5. Applied here, in code,\n// from a field the model never sees.\nif (String(input.customerPlan) === \"free\" && level === 5) level = 4;\n\nreturn String(level);\n",
  "notes": "One judgment moved to the model: how urgent the ticket is, expressed as a single score question over five ordered, standalone level descriptions (from no-rush to production-down/revenue-loss/security-incident), replacing the chat-completion prompt and the /[1-5]/ regex scrape. Everything else stays in code: build_state_js sends only subject and body (truncated for token safety) and deliberately excludes customerPlan and id, since the free-plan cap is a code-side rule applied to the returned answer, not a judgment for the model. decide_js selects the level by taking the argmax of the per-level probabilities (ties resolve to the earlier, less urgent level, which errs toward quieter paging), falls back to rounding the probability-weighted score (+1, treating it as 0-indexed over the criteria) if probabilities are malformed, and falls back further to 3 — the same default the old parse-miss path used — if the answer is unusable. The free-plan rule clamps a 5 to 4 after selection. No thresholds beyond the argmax are introduced yet; per the skill, any tighter gating (e.g. requiring a minimum probability margin before trusting the level, or widening a mid-band toward the 3 default) should be tuned by running the step-8 probe set over real tickets once a specific model is pinned, and the response's model string should be logged alongside each stored rating so drift is traceable."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "subject": "Production API returning 500 for all requests",
      "body": "Since 09:10 UTC every call to /v1/orders returns 500. Our checkout is down and we are losing sales. Enterprise account."
    },
    "answers": {
      "urgency": {
        "type": "score",
        "score": 4,
        "probabilities": {
          "0": 0,
          "1": 0,
          "2": 0,
          "3": 0,
          "4": 1
        },
        "legend": {
          "0": "No rush: a general question, minor cosmetic glitch, or nice-to-have request that can wait for the next regular cycle.",
          "1": "Low urgency: a real annoyance or degraded experience, but there is a workaround and nothing important is blocked.",
          "2": "Moderate urgency: meaningful functionality is impaired or partially blocked, but operations continue and losses are limited.",
          "3": "High urgency: significant work is blocked or failing for the customer today, with real cost accumulating, though some parts still operate.",
          "4": "Maximum urgency: production is down, revenue is actively being lost, or there is an active security incident happening right now."
        },
        "confidence": 1
      }
    },
    "action": "5",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "subject": "Dark mode?",
      "body": "Any plans for a dark mode in the dashboard? Not urgent, just curious."
    },
    "answers": {
      "urgency": {
        "type": "score",
        "score": 0,
        "probabilities": {
          "0": 1,
          "1": 0,
          "2": 0,
          "3": 0,
          "4": 0
        },
        "legend": {
          "0": "No rush: a general question, minor cosmetic glitch, or nice-to-have request that can wait for the next regular cycle.",
          "1": "Low urgency: a real annoyance or degraded experience, but there is a workaround and nothing important is blocked.",
          "2": "Moderate urgency: meaningful functionality is impaired or partially blocked, but operations continue and losses are limited.",
          "3": "High urgency: significant work is blocked or failing for the customer today, with real cost accumulating, though some parts still operate.",
          "4": "Maximum urgency: production is down, revenue is actively being lost, or there is an active security incident happening right now."
        },
        "confidence": 1
      }
    },
    "action": "1",
    "error": null
  }
]
```
