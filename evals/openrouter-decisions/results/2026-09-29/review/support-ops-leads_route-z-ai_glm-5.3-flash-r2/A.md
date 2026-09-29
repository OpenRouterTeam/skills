# support-ops-leads_route-z-ai_glm-5.3-flash-r2

Site: `src/leads/route.ts`

Brief given to both authors:

> Replace the keyword if-chain in routeLead() with a decision model, keeping the same team outputs and the existing source and employee-count rules.

## Candidate A

### Design

```json
{
  "questions": {
    "team": {
      "type": "choice",
      "instructions": "Which sales team should own this inbound lead? Judge only what the message says; company size and lead source are handled by separate rules.",
      "criteria": {
        "developer_relations": "The message is mainly about building on our API or SDK, or a technical integration or embedding of our product into the sender's own product or workflow.",
        "partnerships": "The message is mainly about a commercial partnership: reselling or white-labeling our product to their customers, or a referral, channel, or co-marketing proposal. If the sender's goal is to resell or white-label our product, choose this even when the message also describes technical integration work.",
        "enterprise": "The message is mainly about enterprise buying: procurement, a security review, compliance, contracts, or a rollout across a large organization.",
        "smb": "The message is mainly about getting started as a self-serve or smaller customer: pricing, a trial, a demo, or signing up for a plan.",
        "general_inbox": "None of the above: a general question, a support issue, or anything that does not clearly fit another team."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const ENTERPRISE_MIN_EMPLOYEES = 1000;\n// The two deterministic rules from the original router decide these leads outright, so skip the model.\nif (input.source === \"partner\") return null;\nif (input.employees !== null && input.employees >= ENTERPRISE_MIN_EMPLOYEES) return null;\n// Otherwise the model judges the message, the same field the keyword chain used.\nreturn { message: input.message };",
  "decide_js": "const ENTERPRISE_MIN_EMPLOYEES = 1000;\n// Deterministic rules first; this also covers skipped inputs, where state is null and answers is empty.\nif (input.source === \"partner\") return \"partnerships\";\nif (input.employees !== null && input.employees >= ENTERPRISE_MIN_EMPLOYEES) return \"enterprise\";\n// Model answer: check type before reading fields; a missing key or unexpected type is an error, not a default.\nconst answer = answers.team;\nif (!answer || answer.type !== \"choice\") {\n  throw new Error(\"decisions: missing or non-choice answer for question 'team'\");\n}\nconst TEAMS = { enterprise: true, smb: true, partnerships: true, developer_relations: true, general_inbox: true };\nif (typeof answer.choice !== \"string\" || !TEAMS[answer.choice]) {\n  throw new Error(\"decisions: answer.choice is not one of the five routing teams\");\n}\n// confidence is optional in the schema, so presence-check it; an unsure answer goes to human triage.\nif (typeof answer.confidence === \"number\" && answer.confidence < 0.5) {\n  return \"general_inbox\";\n}\nreturn answer.choice;",
  "notes": "The model judges only the message text: one choice question asks which of the five teams should own the lead, with criteria mirroring the old keyword buckets (API/SDK/integration work -> developer_relations; reselling, white-labeling, or partner proposals -> partnerships; procurement/security review/enterprise buying -> enterprise; pricing/trial/demo -> smb; anything else -> general_inbox) plus a tiebreak saying resale intent outranks integration mechanics, so a message like the embed-and-resell example routes to partnerships where the keywords would have dropped it in the general inbox. The code keeps the two deterministic rules exact: build_state_js returns null (no API call at all) when source is 'partner' or employees >= 1000 (ENTERPRISE_MIN_EMPLOYEES), and decide_js re-applies those same rules from input before touching answers, which also covers the skipped case where state is null and answers is empty. For model-judged leads, decide_js checks answers.team.type === 'choice' before reading choice, throws on a missing or mistyped answer or an out-of-set choice rather than silently defaulting, and presence-checks the optional confidence field: below 0.5 the lead goes to general_inbox for human triage, otherwise the model's choice is returned unchanged. Unlike the keyword chain, conflicts between buckets are now resolved semantically by the model instead of by keyword order."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "message": "We want to embed your reporting in our own product and resell it to our customers under our brand."
    },
    "answers": {
      "team": {
        "type": "choice",
        "choice": "partnerships",
        "probabilities": {
          "partnerships": 1,
          "general_inbox": 0,
          "developer_relations": 0,
          "smb": 0,
          "enterprise": 0
        },
        "confidence": 1
      }
    },
    "action": "partnerships",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "message": "Hi, how do I authenticate against the REST endpoints from a Node service? Docs are unclear."
    },
    "answers": {
      "team": {
        "type": "choice",
        "choice": "developer_relations",
        "probabilities": {
          "general_inbox": 0.01,
          "partnerships": 0,
          "developer_relations": 0.99,
          "smb": 0,
          "enterprise": 0
        },
        "confidence": 0.99
      }
    },
    "action": "developer_relations",
    "error": null
  },
  {
    "skipped_model": true,
    "state": null,
    "answers": {},
    "action": "partnerships",
    "error": null
  }
]
```
