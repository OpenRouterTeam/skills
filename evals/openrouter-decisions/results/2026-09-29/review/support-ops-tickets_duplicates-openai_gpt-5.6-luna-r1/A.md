# support-ops-tickets_duplicates-openai_gpt-5.6-luna-r1

Site: `src/tickets/duplicates.ts`

Brief given to both authors:

> Replace the Jaccard similarity in findDuplicate() with a decision model that picks which open ticket, if any, the new ticket duplicates.

## Candidate A

### Design

```json
{
  "questions": {},
  "build_questions_js": "const candidates = input.open.filter((t) => t.status === \"open\").slice(0, 10);\nconst criteria = {\n  none: \"The new ticket does not describe the same underlying issue as any candidate, even if it concerns the same product area or feature.\"\n};\nfor (let i = 0; i < candidates.length; i += 1) {\n  const candidate = candidates[i];\n  criteria[\"c\" + i] = {\n    candidate_id: candidate.id,\n    subject: candidate.subject,\n    body: candidate.body\n  };\n}\nreturn {\n  duplicate: {\n    type: \"choice\",\n    instructions: \"Determine whether the new ticket is a duplicate of one of the open candidate tickets. Select a candidate only when both tickets report the same underlying problem or request. Do not select a candidate merely because it involves the same product area, feature, or keyword. Select none when there is no clear duplicate.\",\n    criteria\n  }\n};",
  "build_state_js": "const candidates = input.open.filter((t) => t.status === \"open\").slice(0, 10);\nif (candidates.length === 0) return null;\nreturn {\n  ticket: input.ticket,\n  candidates: candidates.map((t) => ({\n    id: t.id,\n    subject: t.subject,\n    body: t.body\n  }))\n};",
  "decide_js": "const answer = answers && answers.duplicate;\nif (!answer || answer.type !== \"choice\" || !state || !Array.isArray(state.candidates)) return \"none\";\nif (typeof answer.choice !== \"string\") return \"none\";\nif (answer.choice === \"none\") return \"none\";\nif (!/^c[0-9]+$/.test(answer.choice)) return \"none\";\nconst index = Number(answer.choice.slice(1));\nif (!Number.isInteger(index) || index < 0 || index >= state.candidates.length) return \"none\";\nreturn \"duplicate\";",
  "notes": "The decision model compares the inbound ticket with up to the first 10 open tickets and chooses the matching candidate only when it represents the same underlying issue; it can explicitly choose none. JavaScript filters out pending tickets, skips the model when there are no open candidates, validates the choice type and candidate index, and returns exactly duplicate or none. There is no lexical-similarity or numeric threshold."
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
      "duplicate": {
        "type": "choice",
        "choice": "c0",
        "probabilities": {
          "c1": 0,
          "none": 0,
          "c0": 1
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
      "duplicate": {
        "type": "choice",
        "choice": "none",
        "probabilities": {
          "none": 1,
          "c0": 0
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
