# support-ops-tickets_duplicates-z-ai_glm-5.3-flash-r3

Site: `src/tickets/duplicates.ts`

Brief given to both authors:

> Replace the Jaccard similarity in findDuplicate() with a decision model that picks which open ticket, if any, the new ticket duplicates.

## Candidate A

### Design

```json
{
  "questions": {},
  "build_questions_js": "if (!state || !state.candidates) return {};\nconst criteria = { none: 'No candidate ticket reports the same underlying problem as the new ticket.' };\nfor (const id of Object.keys(state.candidates)) {\n  criteria[id] = 'Ticket ' + id + ' is a duplicate: it reports the same underlying problem as the new ticket.';\n}\nreturn {\n  duplicate_of: {\n    type: 'choice',\n    instructions: 'State holds the new ticket under `new_ticket` and the open candidate tickets under `candidates`, keyed by ticket ID. Decide which candidate ticket, if any, is a duplicate of the new ticket. A duplicate reports the same underlying problem as the new ticket, even if the wording differs or one report has more or less detail. Tickets that touch the same feature, page, or product area but report different core problems are not duplicates. If no candidate reports the same underlying problem as the new ticket, pick none.',\n    criteria: criteria\n  }\n};",
  "build_state_js": "function clip(s) {\n  return typeof s === 'string' && s.length > 1500 ? s.slice(0, 1500) : s;\n}\nconst candidates = {};\nfor (const t of (input.open || [])) {\n  if (t.status !== 'open') continue;\n  candidates[t.id] = { subject: clip(t.subject), body: clip(t.body) };\n  if (Object.keys(candidates).length >= 10) break;\n}\nif (Object.keys(candidates).length === 0) return null;\nreturn {\n  new_ticket: { subject: clip(input.ticket.subject), body: clip(input.ticket.body) },\n  candidates: candidates\n};",
  "decide_js": "const a = answers.duplicate_of;\nif (!a || a.type !== 'choice') return 'none';\nconst picked = a.choice;\nif (!picked || picked === 'none') return 'none';\nif (!state || !state.candidates || !Object.prototype.hasOwnProperty.call(state.candidates, picked)) return 'none';\nreturn 'duplicate';",
  "notes": "The model makes one `choice` judgment per input: which open candidate ticket, if any, reports the same underlying problem as the new ticket, with a `none` option for no match. The instructions carry the inclusion rule (same core problem despite different wording or amount of detail) and the exclusion rule (tickets about the same feature or page but with different core problems are not duplicates, e.g. 'export button missing' vs 'export has wrong dates'). Code owns every deterministic step: it filters candidates to status 'open' and caps them at 10 exactly as the old implementation did, clips text fields to 1500 characters to bound state size, keys candidates by ticket ID in `state.candidates` so each option is named rather than indexed, and skips the model entirely (build_state_js returns null) when there are no open candidates, which decide_js maps to 'none'. The Jaccard tokenizer, similarity function, and the 0.42 threshold are removed entirely. No probability threshold is applied yet: per pre-probe defaults the gate is the `choice` field itself, and decide_js only validates that the picked option is a real candidate ID, falling back to 'none' on a missing answer, an unexpected type, a 'none' pick, or an unknown ID; after running the probe set, a margin between the picked ticket's probability and `none`'s can be added as a named constant if clear cases land near ties."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "new_ticket": {
        "subject": "Export to CSV missing",
        "body": "The export button on the reports page disappeared after yesterday's update."
      },
      "candidates": {
        "T-2990": {
          "subject": "Reports page: no export option",
          "body": "Can't find CSV export anymore on reports."
        },
        "T-2985": {
          "subject": "CSV export has wrong dates",
          "body": "Exported dates are off by one day."
        }
      }
    },
    "answers": {
      "duplicate_of": {
        "type": "choice",
        "choice": "T-2990",
        "probabilities": {
          "T-2990": 1,
          "none": 0,
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
        "subject": "Invoice PDF is blank",
        "body": "Downloaded my March invoice and the PDF has no content."
      },
      "candidates": {
        "T-2990": {
          "subject": "Reports page: no export option",
          "body": "Can't find CSV export anymore on reports."
        }
      }
    },
    "answers": {
      "duplicate_of": {
        "type": "choice",
        "choice": "none",
        "probabilities": {
          "none": 1,
          "T-2990": 0
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
