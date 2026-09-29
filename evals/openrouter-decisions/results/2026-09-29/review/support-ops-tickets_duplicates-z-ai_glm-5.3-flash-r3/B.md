# support-ops-tickets_duplicates-z-ai_glm-5.3-flash-r3

Site: `src/tickets/duplicates.ts`

Brief given to both authors:

> Replace the Jaccard similarity in findDuplicate() with a decision model that picks which open ticket, if any, the new ticket duplicates.

## Candidate B

### Design

```json
{
  "questions": {},
  "build_questions_js": "if (!state || !Array.isArray(state.candidates) || state.candidates.length === 0) return {};\nconst criteria = {};\nfor (const c of state.candidates) {\n  criteria[c.id] = { subject: c.subject, body: c.body };\n}\ncriteria.none = 'The new ticket does not report the same underlying problem as any listed open ticket.';\nreturn {\n  duplicate_of: {\n    type: 'choice',\n    instructions: 'Which open ticket, if any, does the new ticket duplicate? Pick the option whose subject and body describe the same underlying problem as the new ticket, even if the wording differs. Pick none when no listed ticket reports that problem.',\n    criteria: criteria\n  }\n};",
  "build_state_js": "const candidates = (Array.isArray(input.open) ? input.open : [])\n  .filter((t) => t.status === 'open')\n  .slice(0, 10);\nif (candidates.length === 0) return null;\nreturn {\n  ticket: {\n    id: input.ticket.id,\n    subject: input.ticket.subject,\n    body: input.ticket.body,\n    customerPlan: input.ticket.customerPlan\n  },\n  candidates: candidates.map((t) => ({ id: t.id, subject: t.subject, body: t.body }))\n};",
  "decide_js": "if (!state) return 'none';\nconst a = answers.duplicate_of;\nif (!a || a.type !== 'choice') {\n  throw new Error('duplicate_of: missing answer or unexpected type ' + (a && a.type));\n}\nconst pick = a.choice;\nif (!pick || pick === 'none') return 'none';\nif (!state.candidates.some((c) => c.id === pick)) return 'none';\nconst CONF_MIN = 0.5;\nconst TOP_PROB_MIN = 0.5;\nif (typeof a.confidence === 'number' && a.confidence < CONF_MIN) return 'none';\nif (a.probabilities && typeof a.probabilities[pick] === 'number' && a.probabilities[pick] < TOP_PROB_MIN) return 'none';\nreturn 'duplicate';",
  "notes": "Per input, build_state_js keeps the old code's candidate selection (status 'open' only, capped at 10) and returns null when there are no open candidates, which skips the request entirely; otherwise it ships the new ticket's subject/body/plan and the candidate tickets as state. build_questions_js builds exactly one choice question whose options are the candidate ticket IDs with each candidate's subject and body as the criterion (criteria accept JSON structures) plus a 'none' opt-out, so the model compares real ticket text and semantic sameness of the underlying problem instead of token overlap; because the options vary per input, questions come from build_questions_js and the static questions object is empty, which also keeps us at one Decisions request per input. decide_js checks answers.duplicate_of.type before reading anything and throws on a missing key or unexpected type per the API contract, returns 'none' when the model picks the 'none' option or hallucinates an ID outside the candidate list (defensive, so a garbage answer never links tickets), and otherwise requires both optional signals — answer confidence and the picked option's probability, when present — to clear 0.5 before returning 'duplicate'; the duplicated ticket's id remains available as answers.duplicate_of.choice if the caller wants to link it."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "ticket": {
        "id": "T-3001",
        "subject": "Export to CSV missing",
        "body": "The export button on the reports page disappeared after yesterday's update.",
        "customerPlan": "pro"
      },
      "candidates": [
        {
          "id": "T-2990",
          "subject": "Reports page: no export option",
          "body": "Can't find CSV export anymore on reports."
        },
        {
          "id": "T-2985",
          "subject": "CSV export has wrong dates",
          "body": "Exported dates are off by one day."
        }
      ]
    },
    "answers": {
      "duplicate_of": {
        "type": "choice",
        "choice": "T-2990",
        "probabilities": {
          "T-2990": 1,
          "T-2985": 0,
          "none": 0
        },
        "confidence": 1
      }
    },
    "action": "duplicate",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "ticket": {
        "id": "T-3002",
        "subject": "Invoice PDF is blank",
        "body": "Downloaded my March invoice and the PDF has no content.",
        "customerPlan": "enterprise"
      },
      "candidates": [
        {
          "id": "T-2990",
          "subject": "Reports page: no export option",
          "body": "Can't find CSV export anymore on reports."
        }
      ]
    },
    "answers": {
      "duplicate_of": {
        "type": "choice",
        "choice": "none",
        "probabilities": {
          "T-2990": 0,
          "none": 1
        },
        "confidence": 1
      }
    },
    "action": "none",
    "error": null
  },
  {
    "skipped_model": true,
    "state": null,
    "answers": {},
    "action": "none",
    "error": null
  }
]
```
