# support-ops-tickets_duplicates-z-ai_glm-5.3-flash-r2

Site: `src/tickets/duplicates.ts`

Brief given to both authors:

> Replace the Jaccard similarity in findDuplicate() with a decision model that picks which open ticket, if any, the new ticket duplicates.

## Candidate B

### Design

```json
{
  "questions": {},
  "build_questions_js": "if (!state) return {};\nconst criteria = {};\nfor (const t of state.open_tickets) {\n  criteria[t.id] = t.subject + ' - ' + t.body;\n}\ncriteria.none = 'The new ticket reports a different underlying problem than every open ticket listed.';\nreturn {\n  duplicate_of: {\n    type: 'choice',\n    instructions: 'Which open ticket, if any, is the new ticket a duplicate of? Tickets are duplicates when they report the same underlying problem, even if the wording or details differ. A ticket about a related but distinct problem is not a duplicate. If no open ticket reports the same underlying problem, answer none.',\n    criteria: criteria\n  }\n};",
  "build_state_js": "if (!input.ticket) return null;\nconst candidates = (input.open || []).filter((t) => t && t.status === 'open').slice(0, 10);\nif (candidates.length === 0) return null;\nconst clip = (text, max) => {\n  const s = String(text == null ? '' : text);\n  return s.length <= max ? s : s.slice(0, Math.max(0, max - 3)) + '...';\n};\nreturn {\n  new_ticket: {\n    id: input.ticket.id,\n    subject: clip(input.ticket.subject, 200),\n    body: clip(input.ticket.body, 600),\n    customerPlan: input.ticket.customerPlan\n  },\n  open_tickets: candidates.map((t) => ({ id: t.id, subject: clip(t.subject, 200), body: clip(t.body, 600) }))\n};",
  "decide_js": "const answer = answers ? answers.duplicate_of : null;\nif (!answer || answer.type !== 'choice' || typeof answer.choice !== 'string') return 'none';\nconst ids = state && Array.isArray(state.open_tickets) ? state.open_tickets.map((t) => t.id) : [];\nif (ids.indexOf(answer.choice) === -1) return 'none';\nconst probs = answer.probabilities;\nif (probs && typeof probs === 'object') {\n  const pChoice = typeof probs[answer.choice] === 'number' ? probs[answer.choice] : null;\n  const pNone = typeof probs.none === 'number' ? probs.none : null;\n  if (pChoice !== null && pNone !== null && pChoice < pNone) return 'none';\n}\nreturn 'duplicate';",
  "notes": "build_state_js keeps the old candidate window (status === 'open', first 10 in input order), clips subject/body to 200/600 characters to bound the prompt, and returns null when there are no open candidates so the request is skipped entirely and decide_js still returns an action. The model judges a single choice question, duplicate_of, whose options are the candidate ticket IDs plus none, instructed to pick the ticket reporting the same underlying problem even when wording differs and to treat related-but-distinct issues as none; this replaces both the Jaccard scoring and the fixed 0.42 threshold, so no numeric similarity or confidence cutoff is applied. decide_js validates structure only: answers.duplicate_of must exist with type 'choice' and a choice string naming one of the IDs actually sent (a missing answer, unexpected type, or unknown ID maps to the conservative 'none', matching the old null return, rather than a guessed default), an optional probabilities check (read via presence check) rejects a choice the model itself ranked below none, and otherwise it returns 'duplicate' with the specific ticket recoverable by the caller from the choice value in the answers."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "new_ticket": {
        "id": "T-3001",
        "subject": "Export to CSV missing",
        "body": "The export button on the reports page disappeared after yesterday's update.",
        "customerPlan": "pro"
      },
      "open_tickets": [
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
          "none": 0,
          "T-2990": 1,
          "T-2985": 0
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
      "new_ticket": {
        "id": "T-3002",
        "subject": "Invoice PDF is blank",
        "body": "Downloaded my March invoice and the PDF has no content.",
        "customerPlan": "enterprise"
      },
      "open_tickets": [
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
