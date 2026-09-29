# support-ops-leads_route-z-ai_glm-5.3-flash-r3

Site: `src/leads/route.ts`

Brief given to both authors:

> Replace the keyword if-chain in routeLead() with a decision model, keeping the same team outputs and the existing source and employee-count rules.

## Candidate B

### Design

```json
{
  "questions": {
    "team": {
      "type": "choice",
      "instructions": "Route an inbound sales lead to the sales team that should own it. Judge the primary intent of the lead's message, including paraphrases, not just exact keywords. Choose the single best-fitting option; if several fit equally well, choose the earliest listed.",
      "criteria": {
        "developer_relations": "Technical builders who want to use or integrate the product in their own software for their own use: API or SDK questions, integrations with their own systems, or developer experience topics — but not reselling the product to others.",
        "partnerships": "Go-to-market collaboration: reselling, referring, or distributing the product to their own customers, white-labeling, or offering the product under their own brand — including offers that embed or integrate the product for resale.",
        "enterprise": "Large-organization buying: enterprise agreements or plans, procurement or purchasing processes, security reviews, or compliance and vendor-risk requirements for a large company.",
        "smb": "Standard product evaluation and purchase intent: questions about pricing, plans, free trials, or demo requests, without enterprise procurement signals.",
        "general_inbox": "None of the above clearly applies: general questions, support-style requests, or messages whose intent does not fit the other options."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (input.source === \"partner\") return null;\nif (input.employees !== null && input.employees >= 1000) return null;\nreturn { message: input.message };",
  "decide_js": "if (input.source === \"partner\") return \"partnerships\";\nif (input.employees !== null && input.employees >= 1000) return \"enterprise\";\nconst answer = answers.team;\nif (!answer || answer.type !== \"choice\") throw new Error(\"team answer missing or not a choice answer\");\nconst team = answer.choice;\nif (team === \"developer_relations\" || team === \"partnerships\" || team === \"enterprise\" || team === \"smb\" || team === \"general_inbox\") return team;\nthrow new Error(\"unexpected choice value: \" + team);",
  "notes": "The two deterministic rules stay in code with their original precedence: build_state_js returns null (skipping the model, zero API calls) when source is 'partner' or employees is at least 1000 (the ENTERPRISE_MIN_EMPLOYEES threshold, hardcoded in the sandbox), and decide_js re-checks those same conditions on the input first, so partner-source leads still beat company size and both still beat any message-based routing, exactly as before. For every other lead, exactly one Decisions request is made with the lead's message as state (the old if-chain read only the lowercased message, so nothing else is sent), and a single choice question asks the model to pick among the same five SalesTeam destinations; the criteria restate the scope of the old keyword buckets (API/SDK/integration work, reseller/white-label partnerships, enterprise/procurement/security-review buying, pricing/trial/demo evaluation, everything else) as semantic intent so paraphrases like 'resell it under our brand' route correctly, with the old first-match order kept as an equal-fit tie-break. decide_js reads the answer defensively per the API guidance: a missing 'team' key or an unexpected type throws instead of defaulting, the choice value is validated against the five known teams before being returned as the final action, and optional fields like probabilities and confidence are deliberately unused so routing stays deterministic for a given answer."
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
          "smb": 0,
          "enterprise": 0,
          "developer_relations": 0
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
          "developer_relations": 1,
          "partnerships": 0,
          "general_inbox": 0,
          "enterprise": 0,
          "smb": 0
        },
        "confidence": 1
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
