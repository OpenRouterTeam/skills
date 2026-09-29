# support-ops-tickets_duplicates-openai_gpt-5.6-luna-r2

Site: `src/tickets/duplicates.ts`

Brief given to both authors:

> Replace the Jaccard similarity in findDuplicate() with a decision model that picks which open ticket, if any, the new ticket duplicates.

## Candidate A

### Design

```json
{
  "questions": {},
  "build_questions_js": "const candidates = input.open.filter((t) => t.status === \"open\").slice(0, 10);\nconst criteria = { none: \"The new ticket does not describe the same underlying issue as any candidate, even if it shares related words.\" };\nfor (let i = 0; i < candidates.length; i += 1) {\n  const t = candidates[i];\n  criteria[\"candidate_\" + i] = \"Ticket \" + String(t.id) + \": subject=\" + String(t.subject) + \"; body=\" + String(t.body) + \". Choose this only if the new ticket is a duplicate of this ticket's underlying issue.\";\n}\nreturn {\n  duplicate: {\n    type: \"choice\",\n    instructions: \"Which open ticket, if any, is the new ticket a duplicate of? Choose exactly one candidate only when both tickets describe the same underlying customer problem or incident. Do not match merely because they share a product area or keyword.\",\n    criteria\n  }\n};",
  "build_state_js": "const candidates = input.open.filter((t) => t.status === \"open\").slice(0, 10).map((t, i) => ({\n  key: \"candidate_\" + i,\n  id: t.id,\n  subject: t.subject,\n  body: t.body\n}));\nif (candidates.length === 0) return null;\nreturn {\n  new_ticket: {\n    id: input.ticket.id,\n    subject: input.ticket.subject,\n    body: input.ticket.body,\n    customerPlan: input.ticket.customerPlan\n  },\n  candidates\n};",
  "decide_js": "if (state === null) return \"none\";\nconst answer = answers && answers.duplicate;\nif (!answer || answer.type !== \"choice\" || typeof answer.choice !== \"string\") {\n  throw new Error(\"missing or unexpected duplicate decision answer\");\n}\nif (answer.choice === \"none\") return \"none\";\nconst candidate = state.candidates.find((c) => c.key === answer.choice);\nif (!candidate) throw new Error(\"duplicate decision selected an unknown candidate\");\nif (Object.prototype.hasOwnProperty.call(answer, \"probabilities\")) {\n  if (!answer.probabilities || typeof answer.probabilities[answer.choice] !== \"number\") {\n    throw new Error(\"invalid duplicate decision probabilities\");\n  }\n  if (answer.probabilities[answer.choice] < 0.5) return \"none\";\n}\nif (Object.prototype.hasOwnProperty.call(answer, \"confidence\")) {\n  if (typeof answer.confidence !== \"number\") throw new Error(\"invalid duplicate decision confidence\");\n  if (answer.confidence < 0.5) return \"none\";\n}\nreturn \"duplicate\";",
  "notes": "The decision model compares the new ticket with up to ten open tickets and chooses one candidate only when it represents the same underlying issue, or chooses none. JavaScript limits candidates to open tickets, maps selections back to the candidate list, skips the model when there are no candidates, and applies 0.5 minimum thresholds to optional selected probability and confidence fields; malformed or unexpected answers raise an error."
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
      "candidates": [
        {
          "key": "candidate_0",
          "id": "T-2990",
          "subject": "Reports page: no export option",
          "body": "Can't find CSV export anymore on reports."
        },
        {
          "key": "candidate_1",
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
      "candidates": [
        {
          "key": "candidate_0",
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
