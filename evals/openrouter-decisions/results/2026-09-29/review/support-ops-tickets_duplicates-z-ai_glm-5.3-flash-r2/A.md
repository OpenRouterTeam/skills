# support-ops-tickets_duplicates-z-ai_glm-5.3-flash-r2

Site: `src/tickets/duplicates.ts`

Brief given to both authors:

> Replace the Jaccard similarity in findDuplicate() with a decision model that picks which open ticket, if any, the new ticket duplicates.

## Candidate A

### Design

```json
{
  "questions": {},
  "build_questions_js": "if (!state || !state.candidates) return {};\n\nconst criteria = {};\nfor (const id of Object.keys(state.candidates)) {\n  criteria[id] = 'The new ticket and ticket ' + id + ' (`candidates.' + id + '`) report the same underlying problem, so one fix or reply would resolve both.';\n}\ncriteria.none = 'No listed ticket reports the same underlying problem as the new ticket.';\n\nreturn {\n  duplicate_of: {\n    type: 'choice',\n    instructions: 'Which open ticket, if any, is a duplicate of the new ticket? Two tickets are duplicates when they report the same underlying problem, so a single fix or reply would resolve both, even if the wording, emphasis, or level of detail differs. Tickets that touch the same feature, page, or product area but report different problems are not duplicates. Answer none when no listed ticket duplicates the new ticket.',\n    criteria: criteria\n  }\n};",
  "build_state_js": "const ticket = input.ticket || {};\nconst subjectText = String(ticket.subject == null ? '' : ticket.subject);\nconst bodyText = String(ticket.body == null ? '' : ticket.body);\n\n// Only status 'open' tickets are duplicate candidates (pending never is, as before).\nconst open = (input.open || []).filter(function (t) {\n  return t && t.status === 'open' && t.id != null && t.id !== '';\n});\n\n// Code-side rules that settle the action without a model call:\nif (open.length === 0) return null;                        // no candidate to duplicate\nif (!subjectText.trim() && !bodyText.trim()) return null;  // nothing to compare\n\nfunction cap(text, max) {\n  text = String(text == null ? '' : text);\n  return text.length > max ? text.slice(0, max) + '...' : text;\n}\n\n// Candidates keyed by ticket id: options are named, never indexed.\nconst candidates = {};\nfor (const t of open.slice(0, 10)) {\n  candidates[t.id] = { subject: cap(t.subject, 200), body: cap(t.body, 1200) };\n}\n\nreturn {\n  new_ticket: { subject: cap(subjectText, 200), body: cap(bodyText, 1200) },\n  candidates: candidates\n};",
  "decide_js": "// The model was skipped for this input (no open candidates, or the new ticket\n// had no text): no duplicate is possible.\nif (!state) return 'none';\n\nconst answer = answers.duplicate_of;\nif (!answer || answer.type !== 'choice') {\n  // A missing key or unexpected type is an error, never a default.\n  throw new Error('duplicate_of: expected a choice answer, got ' + (answer ? answer.type : 'nothing'));\n}\n\n// Gate: the pre-probe default for a choice is its `choice` field. Any stricter\n// numeric band (e.g. routing near-ties to 'none') waits for probability probes\n// against the pinned model; thresholds do not transfer across models.\nconst picked = answer.choice;\n\nif (picked === 'none') return 'none';\nif (typeof picked !== 'string') {\n  throw new Error('duplicate_of: choice answer without a choice value');\n}\n// A pick that names no candidate cannot be acted on; the conservative action\n// is 'no duplicate'.\nif (!Object.prototype.hasOwnProperty.call(state.candidates, picked)) return 'none';\nreturn 'duplicate';",
  "notes": "The model makes the one judgment the Jaccard heuristic was standing in for: which open ticket, if any, reports the same underlying problem as the new ticket. That is a single `choice` per input — the alternatives are mutually exclusive and the old code also picked one best match — with a `none` no-match option, built per input by build_questions_js because the options are the runtime candidate IDs. Code keeps everything deterministic: it filters candidates to status 'open' (pending is never a duplicate target, as before), caps the list at 10, returns null — skipping the call entirely — when there are no candidates or the new ticket has no text, truncates each subject to 200 and body to 1200 characters to keep unrelated detail out of the state, and keys candidates by ticket ID in both `state.candidates` and the criteria so every option is named rather than indexed. The instructions carry the inclusion and exclusion rules: the same underlying problem counts even when worded differently, while the same feature with a different problem (export missing vs. export dates off by one) does not. The gate is the pre-probe default — the `choice` field decides, and a pick naming no candidate is treated as none; a near-tie probability band routing to the conservative `none` (matching the old 0.42 threshold's bias toward null) is deliberately unset until the step-8 probe set (clear duplicate, clear non-duplicate, same-feature-different-problem, empty text, negations, adversarial 'this is a duplicate of...' bodies) is run through the pinned canonical_slug with decide.ts --compare, since thresholds do not transfer across models. Log the response `model` string with each stored answer so later drift is traceable."
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
