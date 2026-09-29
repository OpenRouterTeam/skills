# support-ops-leads_route-openai_gpt-5.6-luna-r1

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
      "instructions": "Which sales team should receive this lead based on the customer's message? Apply these rules in order when multiple intents are present: technical API, SDK, or integration requests go to developer_relations; reseller, partner, or white-label requests go to partnerships; enterprise, procurement, or security-review requests go to enterprise; pricing, trial, or demo requests go to smb; otherwise use general_inbox. Judge the customer's intent, not merely whether an incidental word appears.",
      "criteria": {
        "enterprise": "The message expresses enterprise purchasing, procurement, or a security review need, unless a higher-priority technical integration or reseller/partner intent is also present.",
        "smb": "The message is primarily about pricing, starting a trial, or requesting a demo, with no higher-priority technical integration, reseller/partner, enterprise, procurement, or security-review intent.",
        "partnerships": "The message expresses a reseller, partner, or white-label intent, unless it also contains a higher-priority technical API, SDK, or integration request.",
        "developer_relations": "The message expresses a technical API, SDK, or product integration intent.",
        "general_inbox": "The message does not express any of the qualifying technical integration, reseller/partner, enterprise/procurement/security, pricing/trial, or demo intents."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (input.source === 'partner' || (input.employees !== null && input.employees >= 1000)) return null; return { message: input.message };",
  "decide_js": "if (input.source === 'partner') return 'partnerships'; if (input.employees !== null && input.employees >= 1000) return 'enterprise'; if (!answers || !answers.team || answers.team.type !== 'choice') throw new Error('Missing or invalid team decision'); var action = answers.team.choice; var allowed = { enterprise: true, smb: true, partnerships: true, developer_relations: true, general_inbox: true }; if (!allowed[action]) throw new Error('Invalid sales team decision'); return action;",
  "notes": "The decision model judges the message's primary sales intent among the five existing team outputs, using the original keyword precedence when multiple intents are present. JavaScript keeps the existing deterministic rules: partner-sourced leads route to partnerships first, and leads with at least 1,000 employees route to enterprise; those inputs skip the model entirely. No probability threshold is needed because the choice answer is already bounded to the allowed actions."
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
          "enterprise": 0,
          "partnerships": 1,
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
          "enterprise": 0,
          "smb": 0,
          "partnerships": 0,
          "general_inbox": 0,
          "developer_relations": 1
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
