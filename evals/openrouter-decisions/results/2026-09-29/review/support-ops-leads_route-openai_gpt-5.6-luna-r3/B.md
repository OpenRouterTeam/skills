# support-ops-leads_route-openai_gpt-5.6-luna-r3

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
      "instructions": "Route the lead using only case-insensitive substring checks on state.message, exactly matching the original JavaScript rules. Apply the rules in this priority order: first developer_relations if the message contains api, sdk, or integration; then partnerships if it contains reseller, partner, or white label; then enterprise if it contains enterprise, procurement, or security review; then smb if it contains pricing, trial, or demo; otherwise general_inbox. Do not infer intent or use semantic similarity. If multiple categories match, choose the category with the highest priority listed above.",
      "criteria": {
        "enterprise": "The message contains the case-insensitive substring enterprise, procurement, or security review, and none of the higher-priority developer_relations or partnerships patterns match.",
        "smb": "The message contains the case-insensitive substring pricing, trial, or demo, and none of the higher-priority developer_relations, partnerships, or enterprise patterns match.",
        "partnerships": "The message contains the case-insensitive substring reseller, partner, or white label, and no higher-priority developer_relations pattern matches.",
        "developer_relations": "The message contains the case-insensitive substring api, sdk, or integration.",
        "general_inbox": "None of the specified case-insensitive keyword patterns match."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (input.source === \"partner\" || (input.employees !== null && input.employees >= 1000)) return null;\nreturn { message: input.message };",
  "decide_js": "if (input.source === \"partner\") return \"partnerships\";\nif (input.employees !== null && input.employees >= 1000) return \"enterprise\";\nif (state === null) throw new Error(\"missing state for non-deterministic lead\");\nvar answer = answers.team;\nif (!answer || answer.type !== \"choice\" || typeof answer.choice !== \"string\") throw new Error(\"invalid team decision\");\nvar allowed = [\"enterprise\", \"smb\", \"partnerships\", \"developer_relations\", \"general_inbox\"];\nif (allowed.indexOf(answer.choice) === -1) throw new Error(\"unexpected team decision\");\nreturn answer.choice;",
  "notes": "The model judges only the message-based routing category using literal case-insensitive substring rules and the original keyword precedence: developer_relations, partnerships, enterprise, smb, then general_inbox. JavaScript preserves the existing deterministic precedence by routing partner-source leads to partnerships first and leads with at least 1,000 employees to enterprise; those inputs skip the model entirely."
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
        "choice": "general_inbox",
        "probabilities": {
          "developer_relations": 0,
          "enterprise": 0,
          "partnerships": 0.3,
          "smb": 0,
          "general_inbox": 0.7
        },
        "confidence": 0.62
      }
    },
    "action": "general_inbox",
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
        "choice": "general_inbox",
        "probabilities": {
          "general_inbox": 0.86,
          "partnerships": 0,
          "enterprise": 0,
          "developer_relations": 0.14,
          "smb": 0
        },
        "confidence": 0.82
      }
    },
    "action": "general_inbox",
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
