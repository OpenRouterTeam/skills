# support-ops-tickets_duplicates-openai_gpt-5.6-luna-r1

Site: `src/tickets/duplicates.ts`

Brief given to both authors:

> Replace the Jaccard similarity in findDuplicate() with a decision model that picks which open ticket, if any, the new ticket duplicates.

## Candidate B

### Design

```json
{
  "questions": {},
  "build_questions_js": "const candidates = state.candidates;\nconst criteria = Object.create(null);\nfor (const option of Object.keys(candidates)) {\n  criteria[option] = `The new ticket describes the same underlying issue as open ticket ${candidates[option].id}; it is a duplicate rather than merely a related or similar issue.`;\n}\ncriteria.none = \"The new ticket does not duplicate any candidate open ticket.\";\nreturn {\n  duplicate_ticket: {\n    type: \"choice\",\n    instructions: \"Which, if any, open ticket is duplicated by the new ticket? Judge whether the underlying customer issue is the same, not just whether the tickets share words or are generally related.\",\n    criteria\n  }\n};",
  "build_state_js": "const openTickets = Array.isArray(input.open) ? input.open.filter((ticket) => ticket && ticket.status === \"open\").slice(0, 10) : [];\nif (openTickets.length === 0) return null;\nconst candidates = Object.create(null);\nconst seen = new Set();\nfor (const ticket of openTickets) {\n  if (typeof ticket.id !== \"string\" || seen.has(ticket.id)) continue;\n  seen.add(ticket.id);\n  candidates[`ticket:${ticket.id}`] = {\n    id: ticket.id,\n    subject: ticket.subject,\n    body: ticket.body\n  };\n}\nif (Object.keys(candidates).length === 0) return null;\nreturn {\n  ticket: {\n    subject: input.ticket && input.ticket.subject,\n    body: input.ticket && input.ticket.body\n  },\n  candidates\n};",
  "decide_js": "const DUPLICATE_PROBABILITY = 0.5;\nif (!state || !answers || !answers.duplicate_ticket) return \"none\";\nconst answer = answers.duplicate_ticket;\nif (answer.type !== \"choice\" || typeof answer.choice !== \"string\") return \"none\";\nif (answer.choice === \"none\") return \"none\";\nconst candidate = state.candidates && state.candidates[answer.choice];\nif (!candidate || !answer.probabilities || typeof answer.probabilities[answer.choice] !== \"number\") return \"none\";\nreturn answer.probabilities[answer.choice] >= DUPLICATE_PROBABILITY ? \"duplicate\" : \"none\";",
  "notes": "The decision model chooses among the first ten currently open tickets and an explicit none option based on whether the new ticket describes the same underlying issue, while code filters statuses, limits candidates, constructs the keyed candidate state, and maps the selected option to the final action. A selected candidate must have probability at least 0.5; missing or malformed answers and selections below that threshold produce none."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "ticket": {
        "subject": "Export to CSV missing",
        "body": "The export button on the reports page disappeared after yesterday's update."
      },
      "candidates": {
        "ticket:T-2990": {
          "id": "T-2990",
          "subject": "Reports page: no export option",
          "body": "Can't find CSV export anymore on reports."
        },
        "ticket:T-2985": {
          "id": "T-2985",
          "subject": "CSV export has wrong dates",
          "body": "Exported dates are off by one day."
        }
      }
    },
    "answers": {
      "duplicate_ticket": {
        "type": "choice",
        "choice": "ticket:T-2990",
        "probabilities": {
          "ticket:T-2985": 0,
          "none": 0,
          "ticket:T-2990": 1
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
        "subject": "Invoice PDF is blank",
        "body": "Downloaded my March invoice and the PDF has no content."
      },
      "candidates": {
        "ticket:T-2990": {
          "id": "T-2990",
          "subject": "Reports page: no export option",
          "body": "Can't find CSV export anymore on reports."
        }
      }
    },
    "answers": {
      "duplicate_ticket": {
        "type": "choice",
        "choice": "none",
        "probabilities": {
          "ticket:T-2990": 0,
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
