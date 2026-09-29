# support-ops-leads_route-z-ai_glm-5.3-flash-r1

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
      "instructions": "An inbound lead sent the message in `message`. Which sales team should own this lead? Judge what the sender is trying to do with the product, reading the whole message, and pick the team whose work best matches the sender's main goal.",
      "criteria": {
        "developer_relations": "The sender wants to build on the product technically: use its API or SDK, integrate it with their own systems, or embed its functionality in their own software for their own use or product development, rather than reselling the product to others.",
        "partnerships": "The sender wants a commercial arrangement to distribute the product: reselling it to their own customers, white-labeling it under their own brand, or a reseller, referral, or channel partnership.",
        "enterprise": "The sender is asking about an enterprise buying process or enterprise-grade requirements: procurement, a security review, compliance or legal review, contracts, or an enterprise plan.",
        "smb": "The sender is a straightforward prospective buyer asking about pricing, a trial, or a demo.",
        "general_inbox": "None of the above: the message is a support request, a job application, spam, or anything that does not clearly match one of the four teams."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const ENTERPRISE_MIN_EMPLOYEES = 1000;\n// Hard rules settle these inputs, so no model call is spent on them.\nif (input.source === \"partner\") return null;\nif (input.employees !== null && input.employees >= ENTERPRISE_MIN_EMPLOYEES) return null;\n// An empty message has nothing to judge; the original chain returned general_inbox.\nif (typeof input.message !== \"string\" || input.message.trim() === \"\") return null;\nreturn { message: input.message };",
  "decide_js": "const ENTERPRISE_MIN_EMPLOYEES = 1000; // hard rule: 1000+ employees is enterprise; a miss sends a large buyer to the wrong team\nconst TEAMS = [\"enterprise\", \"smb\", \"partnerships\", \"developer_relations\", \"general_inbox\"];\n// Same rules as build_state_js: code owns these outcomes with or without a model answer.\nif (input.source === \"partner\") return \"partnerships\";\nif (input.employees !== null && input.employees >= ENTERPRISE_MIN_EMPLOYEES) return \"enterprise\";\nif (typeof input.message !== \"string\" || input.message.trim() === \"\") return \"general_inbox\";\nconst answer = answers.team;\nif (!answer || answer.type !== \"choice\") throw new Error(\"team answer missing or not a choice\");\nif (!TEAMS.includes(answer.choice)) throw new Error(\"unknown team choice: \" + answer.choice);\nreturn answer.choice;",
  "notes": "The model makes the one judgment the keyword chain stood in for: which sales team should own the lead, sent as a single choice over the five teams with general_inbox as the no-match option. It reads what the sender is trying to do (resell under their own brand, run a security review, integrate via an API) rather than matching substrings, so a message like the Northwind embed-and-resell example routes to partnerships where the keyword chain fell through to general_inbox. Code owns every deterministic step: source === 'partner' returns partnerships and employees >= 1000 returns enterprise before any request is made (build_state_js returns null so no call is spent), an empty or whitespace-only message returns general_inbox, and decide_js re-applies those same named rules on input so skipped inputs still return the right team from an empty answers object. The state carries only the raw, un-lowercased message; source, employee count, company, and email feed code rules or nothing and stay out of the model's view. The gate is the choice field itself with no confidence threshold: the model can already pick general_inbox when nothing fits, a misroute is cheaply corrected downstream, and any confidence band should be set from probed probabilities on real leads rather than a default; a missing answer, an unexpected type, or an out-of-set choice throws instead of defaulting."
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
          "general_inbox": 0,
          "partnerships": 1,
          "smb": 0,
          "developer_relations": 0,
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
          "developer_relations": 0.99,
          "partnerships": 0,
          "enterprise": 0,
          "smb": 0,
          "general_inbox": 0.01
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
