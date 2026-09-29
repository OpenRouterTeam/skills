# support-ops-kb_suggest-z-ai_glm-5.3-flash-r3

Site: `src/kb/suggest.ts`

Brief given to both authors:

> Keep the embedding retrieval in suggestArticle() but replace the similarity threshold with a decision model that picks which of the retrieved articles, if any, answers the ticket.

## Candidate B

### Design

```json
{
  "questions": {},
  "build_questions_js": "const seen = new Set();\nconst criteria = {};\nfor (const c of input.candidates.slice(0, 5)) {\n  if (!seen.has(c.slug)) {\n    seen.add(c.slug);\n    criteria[c.slug] = 'Following \"' + c.title + '\" (' + c.summary + ') would resolve the ticket\\'s actual question or problem.';\n  }\n}\ncriteria['none'] = 'None of the listed articles would resolve the ticket\\'s actual question or problem; they only touch related topics.';\nreturn {\n  best_article: {\n    type: 'choice',\n    instructions: 'One of the articles in `candidates` may answer the support ticket described in `ticket`. Decide which article, if any, actually answers it: judge whether carrying out the article\\'s instructions would solve what the customer needs, not merely whether the article shares keywords or topic area with the ticket. Articles about adjacent features (for example sharing links when the customer wants to invite people, or SSO configuration when the customer just wants to add a teammate) do not count.',\n    criteria\n  }\n};",
  "build_state_js": "if (!Array.isArray(input.candidates) || input.candidates.length === 0) return null;\nconst candidates = {};\nfor (const c of input.candidates.slice(0, 5)) {\n  if (!(c.slug in candidates)) candidates[c.slug] = { title: c.title, summary: c.summary };\n}\nreturn {\n  ticket: { id: input.ticket.id, subject: input.ticket.subject, body: input.ticket.body },\n  candidates\n};",
  "decide_js": "const ans = answers.best_article;\nif (!ans || ans.type !== 'choice') return 'none';\nif (ans.choice === 'none') return 'none';\nconst picked = input.candidates.find(function (c) { return c.slug === ans.choice; });\nreturn picked ? 'suggest' : 'none';",
  "notes": "Code keeps everything computational: embedding the ticket, cosine similarity, ranking, and taking the top 5 candidates. The judgment the old 0.78 threshold approximated — does one of these articles actually answer this ticket — moves to a single dynamic `choice` question whose options are the retrieved slugs plus a `none` escape hatch, so the model compares the candidates relatively instead of code applying a magic cutoff. `build_state_js` sends only what the question reads (ticket subject/body and each candidate's title and summary keyed by slug, per the runtime-candidate convention) and returns null to skip the model entirely when retrieval produced no candidates, in which case `decide_js` returns 'none'. Cosine similarities are deliberately kept out of the state: they fed the retired code-side rule and adding them risks the model anchoring on numbers instead of judging content. `decide_js` trusts the `choice` field outright (the pre-probe default of treating the selected option as the answer), validates the picked slug against the actual candidate list as a safety net, and falls back to 'none' on malformed answers. After running the step-8 probe set, consider using `confidence` or the runner-up gap in `probabilities` to widen a band near the boundary that routes to 'none' rather than a borderline suggestion, tuning that constant against observed distributions rather than assuming it."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "ticket": {
        "id": "T-4001",
        "subject": "How do I add a teammate?",
        "body": "I want my colleague to see the same dashboards. Where do I invite them?"
      },
      "candidates": {
        "invite-users": {
          "title": "Inviting users to your workspace",
          "summary": "Add teammates from Settings, assign roles, and resend invitations."
        },
        "share-dashboard-link": {
          "title": "Sharing a dashboard by link",
          "summary": "Create a read-only public link to a single dashboard."
        },
        "sso-setup": {
          "title": "Setting up SSO",
          "summary": "Configure SAML with Okta or Azure AD on enterprise plans."
        }
      }
    },
    "answers": {
      "best_article": {
        "type": "choice",
        "choice": "invite-users",
        "probabilities": {
          "sso-setup": 0,
          "invite-users": 1,
          "none": 0,
          "share-dashboard-link": 0
        },
        "confidence": 1
      }
    },
    "action": "suggest",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "ticket": {
        "id": "T-4002",
        "subject": "Wrong VAT on invoice",
        "body": "Our invoice shows 20% VAT but we are registered in Germany."
      },
      "candidates": {
        "invite-users": {
          "title": "Inviting users to your workspace",
          "summary": "Add teammates from Settings, assign roles, and resend invitations."
        },
        "sso-setup": {
          "title": "Setting up SSO",
          "summary": "Configure SAML with Okta or Azure AD on enterprise plans."
        }
      }
    },
    "answers": {
      "best_article": {
        "type": "choice",
        "choice": "none",
        "probabilities": {
          "invite-users": 0,
          "sso-setup": 0,
          "none": 1
        },
        "confidence": 1
      }
    },
    "action": "none",
    "error": null
  }
]
```
