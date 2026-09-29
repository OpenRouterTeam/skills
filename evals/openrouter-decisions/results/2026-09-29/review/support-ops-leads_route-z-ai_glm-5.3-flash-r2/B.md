# support-ops-leads_route-z-ai_glm-5.3-flash-r2

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
      "instructions": "Which team should own this inbound lead? Judge what the lead wants to do, as described in `message` — not which words appear — and pick the single team whose description best matches the lead's main ask.",
      "criteria": {
        "developer_relations": "The lead is a developer or technical team that wants to build on the product itself — for example API access, an SDK, or integrating it into their own code or product.",
        "partnerships": "The lead wants a commercial partnership rather than to buy the product for their own use — for example reselling it, white-labeling it, or embedding it in their own offering under their brand.",
        "enterprise": "The lead is a large organization buying through a formal process — for example procurement, a security review, compliance requirements, or an enterprise-wide rollout.",
        "smb": "The lead is a smaller business that wants the product for their own use — for example asking about pricing, starting a trial, or requesting a demo.",
        "general_inbox": "None of the other descriptions matches what the lead is asking for."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "const ENTERPRISE_MIN_EMPLOYEES = 1000;\n\n// Code settles these without the model, in the original chain's order.\nif (input.source === \"partner\") return null;\nif (input.employees !== null && input.employees >= ENTERPRISE_MIN_EMPLOYEES) return null;\nif (typeof input.message !== \"string\" || input.message.trim() === \"\") return null;\n\n// The model judges only from the message. Source, employees, email, and company\n// are either code rules here or unread by the question, so none goes into state.\nreturn { message: input.message };",
  "decide_js": "const ENTERPRISE_MIN_EMPLOYEES = 1000;\nconst TEAMS = [\"enterprise\", \"smb\", \"partnerships\", \"developer_relations\", \"general_inbox\"];\n\n// Same rules, same order as build_state: when one fires, the model was skipped,\n// so produce its action here. A misroute sends a lead to the wrong seller;\n// general_inbox only costs a manual triage, so it stays the fallback.\nif (input.source === \"partner\") return \"partnerships\";\nif (input.employees !== null && input.employees >= ENTERPRISE_MIN_EMPLOYEES) return \"enterprise\";\nif (typeof input.message !== \"string\" || input.message.trim() === \"\") return \"general_inbox\";\n\n// Model judgment: before probing, the choice field is the gate.\nconst answer = answers.team;\nif (!answer || answer.type !== \"choice\") return \"general_inbox\";\nconst pick = answer.choice;\nreturn TEAMS.includes(pick) ? pick : \"general_inbox\";",
  "notes": "The keyword chain's one real judgment — which team owns this lead — becomes a single choice question over the five teams, judged from `message` alone, with `general_inbox` as the no-match option; the criteria describe what each lead wants (build on the product, resell or white-label, formal enterprise buying, evaluate for own use) rather than which words appear, so a negated or technically worded ask like the example's embed-and-resell message routes on intent instead of falling through to general_inbox. Code keeps everything deterministic: the source rule (partner -> partnerships), the employee-count rule (>= ENTERPRISE_MIN_EMPLOYEES = 1000 -> enterprise; too-small companies in enterprise waste an AE's time, too-large ones elsewhere delay the deal), and empty or whitespace messages (-> general_inbox) are evaluated identically in build_state_js — which returns null and skips the model call entirely — and in decide_js, which must re-run them because a skipped call arrives with empty answers; both are pure functions of input, so the duplicated rules cannot diverge. State carries only `message`, since source, employees, email, and company are either code rules or unread by the question. Before probing, the model's `choice` field is the gate with no numeric threshold, and a missing or mistyped answer falls back to general_inbox to keep the function total (in production, log that as an error together with the response `model` string on every stored answer); after running the step-8 probe set — a clear case per team, a multi-signal message, a no-match message, an empty message, a negated ask such as 'no demo needed, we want to resell', and text arguing for its own classification — through decide.ts --compare across the live catalog's candidates, add a confidence band routing to general_inbox only if the observed distributions warrant it, and pin the winning canonical_slug in config, since thresholds do not carry between models."
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
          "developer_relations": 0,
          "partnerships": 1,
          "smb": 0,
          "general_inbox": 0,
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
