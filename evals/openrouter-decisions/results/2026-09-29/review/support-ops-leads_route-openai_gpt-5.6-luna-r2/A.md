# support-ops-leads_route-openai_gpt-5.6-luna-r2

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
      "instructions": "Which sales team should own this lead based on the customer's message? Apply these precedence rules when multiple categories are present: developer_relations first, then partnerships, then enterprise, then smb. Choose general_inbox when none applies.",
      "criteria": {
        "developer_relations": "The message is primarily about an API, SDK, software integration, or integrating the product into a technical system. This category takes precedence over the others when multiple categories apply.",
        "partnerships": "The message is primarily about reselling, becoming a partner, white-labeling, distributing the product, or using it under the customer's brand. Use this only when developer_relations does not apply.",
        "enterprise": "The message is primarily about enterprise purchasing, procurement, enterprise requirements, or a security review. Use this only when developer_relations and partnerships do not apply.",
        "smb": "The message is primarily about pricing, a trial, or requesting a demo. Use this only when none of the higher-priority categories apply.",
        "general_inbox": "The message does not clearly fit any of the categories above."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (input.source === \"partner\" || (input.employees !== null && input.employees >= 1000)) return null; return { message: input.message };",
  "decide_js": "if (input.source === \"partner\") return \"partnerships\"; if (input.employees !== null && input.employees >= 1000) return \"enterprise\"; var answer = answers && answers.team; if (answer && answer.type === \"choice\" && [\"enterprise\", \"smb\", \"partnerships\", \"developer_relations\", \"general_inbox\"].includes(answer.choice)) return answer.choice; return \"general_inbox\";",
  "notes": "The decision model classifies the lead message into the same five message-based teams, with explicit precedence matching the original if-chain. Code retains the existing deterministic rules and skips the model for partner-sourced leads and leads with at least 1,000 employees; source=partner still routes to partnerships before the employee rule, and employee count >= 1,000 routes to enterprise otherwise. No probability threshold is needed because the model returns a bounded choice."
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
          "smb": 0,
          "partnerships": 0.55,
          "enterprise": 0,
          "developer_relations": 0.45
        },
        "confidence": 0.43
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
          "smb": 0,
          "partnerships": 0,
          "enterprise": 0,
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
