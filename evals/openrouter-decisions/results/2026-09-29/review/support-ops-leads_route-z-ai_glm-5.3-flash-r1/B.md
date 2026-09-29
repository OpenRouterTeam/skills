# support-ops-leads_route-z-ai_glm-5.3-flash-r1

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
      "instructions": "An inbound lead sent the message in the state to our sales team. Which team should own this lead? Judge by the message's main intent.",
      "criteria": {
        "developer_relations": "The message is mainly a technical question: using or integrating the product via its API or SDK, or embedding it into their own stack as a code-level integration.",
        "partnerships": "The message is about a commercial arrangement: reselling the product to their own customers, white-labeling it under their own brand, or an OEM embed-and-resell deal.",
        "enterprise": "The message is about an enterprise purchase: enterprise plans, procurement, or a security review.",
        "smb": "The message is about evaluating the product: pricing, starting a trial, or requesting a demo.",
        "general_inbox": "The message does not clearly fit any of the teams above."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "// Deterministic rules decide these inputs without a model call (same precedence as the original chain).\nif (input.source === \"partner\") return null;\nif (input.employees !== null && input.employees >= 1000) return null;\nreturn {\n  company: input.company,\n  source: input.source,\n  employees: input.employees,\n  message: input.message\n};",
  "decide_js": "// Deterministic rules first, same precedence as the original routeLead; these also cover\n// inputs where build_state_js skipped the model (state null, answers empty).\nif (input.source === \"partner\") return \"partnerships\";\nif (input.employees !== null && input.employees >= 1000) return \"enterprise\";\n\n// Model answer replaces the keyword if-chain.\nconst answer = answers.team;\nif (!answer || answer.type !== \"choice\") return \"general_inbox\";\nconst teams = [\"enterprise\", \"smb\", \"partnerships\", \"developer_relations\", \"general_inbox\"];\nreturn teams.includes(answer.choice) ? answer.choice : \"general_inbox\";",
  "notes": "The model replaces only the keyword if-chain: a single choice question, 'team', asks which of the five sales teams owns the lead based on the message's main intent, with option descriptions encoding the old keyword intents (API/SDK/technical integration -> developer_relations; reseller/white-label/embed-and-resell -> partnerships; enterprise/procurement/security review -> enterprise; pricing/trial/demo -> smb; anything else -> general_inbox), and state carries message, company, source, and employee count as context. Code keeps the two deterministic rules with their original precedence: source 'partner' -> partnerships and employees >= 1000 -> enterprise; build_state_js returns null for those inputs so no request is spent, and decide_js re-applies the same checks first (1000 hardcoded, since the sandbox cannot see ENTERPRISE_MIN_EMPLOYEES) before reading answers. The answer's type is checked before reading 'choice'; if the team answer is missing, has an unexpected type, or names an unknown option, decide_js falls back to general_inbox, the original chain's default branch, so the output is always one of the five teams. No confidence threshold is applied."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "company": "Northwind",
      "source": "website_form",
      "employees": 240,
      "message": "We want to embed your reporting in our own product and resell it to our customers under our brand."
    },
    "answers": {
      "team": {
        "type": "choice",
        "choice": "partnerships",
        "probabilities": {
          "smb": 0,
          "partnerships": 1,
          "enterprise": 0,
          "developer_relations": 0,
          "general_inbox": 0
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
      "company": "Tiny Shop",
      "source": "website_form",
      "employees": 6,
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
