# support-ops-leads_route-openai_gpt-5.6-luna-r2

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
      "instructions": "Route this lead's message using the same intent categories as the existing routing rules. Choose the best matching sales team.",
      "criteria": {
        "developer_relations": "The message is about an API, SDK, integration, embedding, or connecting the product to another system.",
        "partnerships": "The message is about a reseller, partner arrangement, white-label offering, or reselling the product.",
        "enterprise": "The message is about enterprise purchasing, procurement, or a security review.",
        "smb": "The message is about pricing, a trial, or requesting a demo.",
        "general_inbox": "The message does not match any of the other categories."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (input.source === \"partner\" || (input.employees !== null && input.employees >= 1000)) return null;\nreturn { message: input.message };",
  "decide_js": "if (input.source === \"partner\") return \"partnerships\";\nif (input.employees !== null && input.employees >= 1000) return \"enterprise\";\nconst answer = answers.team;\nif (!answer || answer.type !== \"choice\") throw new Error(\"Invalid team decision answer\");\nconst valid = [\"enterprise\", \"smb\", \"partnerships\", \"developer_relations\", \"general_inbox\"];\nif (!valid.includes(answer.choice)) throw new Error(\"Invalid team decision\");\nreturn answer.choice;",
  "notes": "The decision model classifies non-forced leads by message intent into the same five team categories represented by the former keyword rules. Code preserves the existing precedence exactly: partner-source leads route to partnerships first, and leads with at least 1,000 employees route to enterprise; those cases skip the model. All other leads make one Decisions API request, and the selected team is returned after validating the choice."
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
          "enterprise": 0,
          "partnerships": 0.99,
          "general_inbox": 0,
          "smb": 0,
          "developer_relations": 0.01
        },
        "confidence": 0.98
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
          "enterprise": 0,
          "smb": 0,
          "general_inbox": 0
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
