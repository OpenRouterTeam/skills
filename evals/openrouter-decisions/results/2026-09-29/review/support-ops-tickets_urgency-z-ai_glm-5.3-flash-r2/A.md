# support-ops-tickets_urgency-z-ai_glm-5.3-flash-r2

Site: `src/tickets/urgency.ts`

Brief given to both authors:

> Replace the chat-completion call and regex parsing in rateUrgency() with a decision model, keeping the same 1 to 5 urgency output and the existing rule that free-plan tickets never rate 5.

## Candidate A

### Design

```json
{
  "questions": {
    "urgency": {
      "type": "score",
      "instructions": "Rate how urgently this support ticket needs a response and a fix, based on the operational impact the reporter describes. Judge the substance of the reported situation, not the tone: demanding, alarmed, or polite language does not raise or lower the rating on its own. A claim of downtime or lost revenue raises the rating only when the reporter describes it actually happening to their system.",
      "criteria": [
        "No rush: a routine question, a cosmetic glitch, or a nice-to-have request; waiting days for a resolution harms nobody.",
        "Low urgency: a minor inconvenience with a reasonable workaround; nothing is blocked today and it can wait a few days.",
        "Moderate urgency: real degradation or recurring friction that disrupts normal work; it should be addressed this week.",
        "High urgency: significant breakage that blocks important operations right now; it needs attention today.",
        "Critical urgency: a production outage, active data loss or exposure, ongoing revenue-blocking failure, or a security incident happening now."
      ]
    }
  },
  "build_questions_js": null,
  "build_state_js": "var s = String(input.subject == null ? '' : input.subject).trim();\nvar b = String(input.body == null ? '' : input.body).trim();\nif (!s && !b) return null;\nreturn { subject: s, body: b };",
  "decide_js": "// Default mirrors the old regex-miss fallback.\nif (!answers || !answers.urgency || answers.urgency.type !== 'score') return '3';\n\nvar a = answers.urgency;\nvar probs = a.probabilities || {};\n\n// Pick the level by highest probability mass. Legend indexes levels from \"0\",\n// so key i corresponds to level i + 1. Never interpolate a magnitude from the\n// scalar score; argmax keeps us on a discrete level.\nvar bestKey = null, bestP = -1;\nfor (var k in probs) {\n  var p = Number(probs[k]);\n  if (probs.hasOwnProperty(k) && p === p && p > bestP) { bestP = p; bestKey = k; }\n}\n\nvar level;\nif (bestKey != null) {\n  level = Math.round(Number(bestKey)) + 1;\n} else if (typeof a.score === 'number' && a.score === a.score) {\n  // Defensive fallback if probabilities are absent; score is a weighted\n  // position over the five levels, so round onto the nearest level.\n  level = Math.round(a.score);\n} else {\n  return '3';\n}\nlevel = Math.min(5, Math.max(1, level));\n\n// Hard policy kept in code: free-plan tickets never rate 5.\nif (String(input.customerPlan) === 'free' && level === 5) level = 4;\n\nreturn String(level);",
  "notes": "What the model judges: one score question rates the ticket's urgency across five ordered levels, with criteria that stand alone and instruct the model to weigh described operational impact rather than tone, guarding against adversarial shouting ('URGENT!!') inflating a trivial ticket. What code computes: everything else. Empty subject and body skip the model entirely and return the legacy default of 3, mirroring the old regex-miss fallback; the free-plan cap (any 5 collapses to 4) is enforced in decide_js from input.customerPlan, which is deliberately excluded from the state so the plan-tier rule stays code-side and never biases the model's judgment; the final level is taken as the argmax of the per-level probabilities (mapped from the 0-based legend keys) rather than interpolated from the scalar score, since score expectations are not calibrated between levels; a missing or mistyped answer falls back to 3. There are no tunable thresholds yet — argmax over five levels needs no gate — though once probes show borderline distributions, a minimum-probability floor below which we route to manual review would slot in beside the argmax in decide_js. Probe before trusting: cover a clear 5 (outage with revenue loss), a clear 1 (cosmetic nit), a free-plan ticket describing an outage (must land on 4), an angry-but-trivial complaint, an empty ticket, and a body claiming 'this is a security emergency' about a font size."
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
          "0": "No rush: a routine question, a cosmetic glitch, or a nice-to-have request; waiting days for a resolution harms nobody.",
          "1": "Low urgency: a minor inconvenience with a reasonable workaround; nothing is blocked today and it can wait a few days.",
          "2": "Moderate urgency: real degradation or recurring friction that disrupts normal work; it should be addressed this week.",
          "3": "High urgency: significant breakage that blocks important operations right now; it needs attention today.",
          "4": "Critical urgency: a production outage, active data loss or exposure, ongoing revenue-blocking failure, or a security incident happening now."
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
          "0": "No rush: a routine question, a cosmetic glitch, or a nice-to-have request; waiting days for a resolution harms nobody.",
          "1": "Low urgency: a minor inconvenience with a reasonable workaround; nothing is blocked today and it can wait a few days.",
          "2": "Moderate urgency: real degradation or recurring friction that disrupts normal work; it should be addressed this week.",
          "3": "High urgency: significant breakage that blocks important operations right now; it needs attention today.",
          "4": "Critical urgency: a production outage, active data loss or exposure, ongoing revenue-blocking failure, or a security incident happening now."
        },
        "confidence": 1
      }
    },
    "action": "1",
    "error": null
  }
]
```
