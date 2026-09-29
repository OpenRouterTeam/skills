# support-ops-kb_suggest-z-ai_glm-5.3-flash-r2

Site: `src/kb/suggest.ts`

Brief given to both authors:

> Keep the embedding retrieval in suggestArticle() but replace the similarity threshold with a decision model that picks which of the retrieved articles, if any, answers the ticket.

## Candidate B

### Design

```json
{
  "questions": {},
  "build_questions_js": "const criteria = {};\nconst candidates = input.candidates || [];\nfor (const c of candidates) {\n  criteria[c.slug] = (c.title || \"\") + \" — \" + (c.summary || \"\");\n}\ncriteria.none = \"No retrieved article addresses the customer's ticket.\";\nreturn {\n  article: {\n    type: \"choice\",\n    instructions: \"Which retrieved article, if any, answers the customer's ticket? The candidates are the top results from embedding retrieval. Choose an article only if it actually addresses the reported question or problem; otherwise choose none.\",\n    criteria: criteria\n  }\n};",
  "build_state_js": "if (!input.candidates || input.candidates.length === 0) return null;\nreturn {\n  ticket: {\n    id: input.ticket.id,\n    subject: input.ticket.subject,\n    body: input.ticket.body,\n    customerPlan: input.ticket.customerPlan\n  },\n  candidates: input.candidates.map(function (c) {\n    return { slug: c.slug, title: c.title, summary: c.summary };\n  })\n};",
  "decide_js": "if (!state) return \"none\";\nconst answer = answers.article;\nif (!answer || answer.type !== \"choice\") {\n  throw new Error(\"decisions: missing answer or unexpected type for question 'article'\");\n}\nconst pick = answer.choice;\nif (!pick || pick === \"none\") return \"none\";\nconst known = {};\nfor (const c of state.candidates) {\n  known[c.slug] = true;\n}\nreturn known[pick] ? \"suggest\" : \"none\";",
  "notes": "Embedding retrieval is unchanged: suggestArticle still embeds the ticket, cosine-ranks all articles, and keeps the top 5; only the SUGGEST_THRESHOLD cutoff is removed, so the retrieved candidates arrive in input.candidates in ranked order. At most one Decisions API request runs per input: build_state_js returns null (skipping the model entirely) when retrieval produced no candidates, and otherwise returns a state with the ticket (id, subject, body, plan) plus the candidate slugs/titles/summaries; build_questions_js builds a single 'article' choice question whose options are the candidate slugs — each described by its title and summary — plus a 'none' option, because the option set depends on each input's candidates. decide_js treats a missing answer or an unexpected type as an error (it throws, per the API contract, rather than defaulting), returns 'none' when the model chose 'none' or named a slug that is not among the retrieved candidates, and returns 'suggest' only when the model picked a retrieved slug, in which case the article to show is the one identified by answers.article.choice. No numeric similarity or confidence threshold is applied anywhere — the model's 'none' option fully replaces the old 0.78 cutoff."
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
