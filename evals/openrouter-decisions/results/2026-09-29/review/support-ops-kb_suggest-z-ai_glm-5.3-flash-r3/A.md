# support-ops-kb_suggest-z-ai_glm-5.3-flash-r3

Site: `src/kb/suggest.ts`

Brief given to both authors:

> Keep the embedding retrieval in suggestArticle() but replace the similarity threshold with a decision model that picks which of the retrieved articles, if any, answers the ticket.

## Candidate A

### Design

```json
{
  "questions": {},
  "build_questions_js": "if (!state) return {};\nconst criteria = {};\nfor (const c of state.candidates) {\n  criteria[c.slug] = 'Title: ' + c.title + '. Summary: ' + c.summary;\n}\ncriteria.none = 'None of the listed articles answers the ticket.';\nreturn {\n  article: {\n    type: 'choice',\n    instructions: 'A support ticket was matched against the knowledge-base articles listed in state.candidates, ordered by embedding similarity (best first). Pick the single article that actually answers the ticket, or none if no article genuinely helps the customer. Retrieval rank alone does not guarantee relevance.',\n    criteria: criteria\n  }\n};",
  "build_state_js": "if (!input || !Array.isArray(input.candidates) || input.candidates.length === 0) return null;\nreturn {\n  ticket: {\n    id: input.ticket.id,\n    subject: input.ticket.subject,\n    body: input.ticket.body,\n    customerPlan: input.ticket.customerPlan\n  },\n  candidates: input.candidates.map((c) => ({ slug: c.slug, title: c.title, summary: c.summary }))\n};",
  "decide_js": "const answer = answers && answers.article;\nif (!answer || answer.type !== 'choice') return 'none';\nconst pick = answer.choice;\nif (typeof pick !== 'string' || pick === 'none') return 'none';\nconst candidates = state && Array.isArray(state.candidates) ? state.candidates : [];\nconst picked = candidates.some((c) => c.slug === pick);\nreturn picked ? 'suggest' : 'none';",
  "notes": "suggestArticle keeps its embedding retrieval unchanged: it embeds the ticket, cosine-ranks all articles, and keeps the top 5; the hard-coded SUGGEST_THRESHOLD = 0.78 cutoff is deleted. The single Decisions request per input sends state = { ticket, candidates } (the ranked top-5 with slug/title/summary) and one choice question whose options are the candidate slugs, each described by its title and summary, plus an explicit 'none' option, so the model rather than a numeric threshold decides whether anything is worth suggesting. build_state_js returns null when retrieval produced no candidates, which skips the API call, and decide_js then returns 'none' against the empty answers object. decide_js treats a missing answer, an unexpected type, the 'none' option, or a slug that is not among the retrieved candidates as 'none' (per the API contract, an unexpected type or missing key is an error, never a default); when the model picks a real slug it returns 'suggest', and the surrounding code reads that same answer's choice field to return the matching Article. No similarity or confidence threshold is applied anywhere."
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
        "body": "I want my colleague to see the same dashboards. Where do I invite them?",
        "customerPlan": "pro"
      },
      "candidates": [
        {
          "slug": "invite-users",
          "title": "Inviting users to your workspace",
          "summary": "Add teammates from Settings, assign roles, and resend invitations."
        },
        {
          "slug": "share-dashboard-link",
          "title": "Sharing a dashboard by link",
          "summary": "Create a read-only public link to a single dashboard."
        },
        {
          "slug": "sso-setup",
          "title": "Setting up SSO",
          "summary": "Configure SAML with Okta or Azure AD on enterprise plans."
        }
      ]
    },
    "answers": {
      "article": {
        "type": "choice",
        "choice": "invite-users",
        "probabilities": {
          "sso-setup": 0,
          "invite-users": 1,
          "share-dashboard-link": 0,
          "none": 0
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
        "body": "Our invoice shows 20% VAT but we are registered in Germany.",
        "customerPlan": "enterprise"
      },
      "candidates": [
        {
          "slug": "invite-users",
          "title": "Inviting users to your workspace",
          "summary": "Add teammates from Settings, assign roles, and resend invitations."
        },
        {
          "slug": "sso-setup",
          "title": "Setting up SSO",
          "summary": "Configure SAML with Okta or Azure AD on enterprise plans."
        }
      ]
    },
    "answers": {
      "article": {
        "type": "choice",
        "choice": "none",
        "probabilities": {
          "none": 1,
          "invite-users": 0,
          "sso-setup": 0
        },
        "confidence": 1
      }
    },
    "action": "none",
    "error": null
  }
]
```
