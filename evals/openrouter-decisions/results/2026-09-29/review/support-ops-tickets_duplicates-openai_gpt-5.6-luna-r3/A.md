# support-ops-tickets_duplicates-openai_gpt-5.6-luna-r3

Site: `src/tickets/duplicates.ts`

Brief given to both authors:

> Replace the Jaccard similarity in findDuplicate() with a decision model that picks which open ticket, if any, the new ticket duplicates.

## Candidate A

### Design

```json
{
  "questions": {},
  "build_questions_js": "const candidates = input.open.filter((t) => t.status === \"open\").slice(0, 10); const criteria = { none: \"None of the candidate tickets describes the same underlying customer issue as the new ticket.\" }; candidates.forEach((t, i) => { criteria[\"candidate_\" + i] = \"Select this ticket only if it is the same underlying issue as the new ticket, rather than merely a related topic. Ticket ID: \" + t.id + \". Subject: \" + t.subject + \". Body: \" + t.body; }); return { duplicate: { type: \"choice\", instructions: \"Which open ticket, if any, is an actual duplicate of the new ticket? Choose none when the tickets concern different issues, even if they share keywords or a product area.\", criteria: criteria } };",
  "build_state_js": "const candidates = input.open.filter((t) => t.status === \"open\").slice(0, 10).map((t, i) => ({ option: \"candidate_\" + i, id: t.id, subject: t.subject, body: t.body })); if (candidates.length === 0) return null; return { new_ticket: input.ticket, open_candidates: candidates };",
  "decide_js": "if (!state || !answers || !answers.duplicate) return \"none\"; const answer = answers.duplicate; if (answer.type !== \"choice\" || typeof answer.choice !== \"string\") return \"none\"; if (answer.choice === \"none\") return \"none\"; const candidate = state.open_candidates.find((t) => t.option === answer.choice); if (!candidate) return \"none\"; if (typeof answer.confidence === \"number\" && answer.confidence < 0.6) return \"none\"; if (answer.probabilities && typeof answer.probabilities[answer.choice] === \"number\" && answer.probabilities[answer.choice] < 0.55) return \"none\"; return \"duplicate\";",
  "notes": "The decision model compares the new ticket with up to the first 10 open tickets and selects the candidate representing the same underlying issue, or none for merely related tickets. JavaScript excludes pending tickets, skips the model when there are no open candidates, validates the choice, and requires confidence of at least 0.6 and (when supplied) selected probability of at least 0.55 before returning duplicate; otherwise it returns none."
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
      "open_candidates": [
        {
          "option": "candidate_0",
          "id": "T-2990",
          "subject": "Reports page: no export option",
          "body": "Can't find CSV export anymore on reports."
        },
        {
          "option": "candidate_1",
          "id": "T-2985",
          "subject": "CSV export has wrong dates",
          "body": "Exported dates are off by one day."
        }
      ]
    },
    "answers": {
      "duplicate": {
        "type": "choice",
        "choice": "candidate_0",
        "probabilities": {
          "candidate_1": 0,
          "none": 0,
          "candidate_0": 1
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
      "open_candidates": [
        {
          "option": "candidate_0",
          "id": "T-2990",
          "subject": "Reports page: no export option",
          "body": "Can't find CSV export anymore on reports."
        }
      ]
    },
    "answers": {
      "duplicate": {
        "type": "choice",
        "choice": "none",
        "probabilities": {
          "none": 1,
          "candidate_0": 0
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
