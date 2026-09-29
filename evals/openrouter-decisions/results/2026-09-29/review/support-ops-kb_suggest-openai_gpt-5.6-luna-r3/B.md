# support-ops-kb_suggest-openai_gpt-5.6-luna-r3

Site: `src/kb/suggest.ts`

Brief given to both authors:

> Keep the embedding retrieval in suggestArticle() but replace the similarity threshold with a decision model that picks which of the retrieved articles, if any, answers the ticket.

## Candidate B

### Design

```json
{
  "questions": {},
  "build_questions_js": "const criteria = Object.create(null);\nfor (const candidate of input.candidates || []) {\n  if (!candidate || typeof candidate.slug !== \"string\" || candidate.slug === \"none\") continue;\n  criteria[candidate.slug] = {\n    title: candidate.title,\n    summary: candidate.summary,\n    rule: \"Choose this article only if it directly answers the customer's ticket.\"\n  };\n}\ncriteria.none = \"None of the retrieved articles directly answers the customer's ticket.\";\nreturn {\n  article: {\n    type: \"choice\",\n    instructions: \"Which one of the retrieved knowledge-base articles, if any, directly answers the customer's ticket? Choose an article only when its subject and summary address the customer's actual request, not merely a related topic. Choose none when no article is a direct answer.\",\n    criteria\n  }\n};",
  "build_state_js": "const ticket = input && input.ticket;\nconst candidates = Array.isArray(input && input.candidates) ? input.candidates : [];\nif (!ticket || candidates.length === 0) return null;\nconst subject = typeof ticket.subject === \"string\" ? ticket.subject.trim() : \"\";\nconst body = typeof ticket.body === \"string\" ? ticket.body.trim() : \"\";\nif (!subject && !body) return null;\nconst candidateState = Object.create(null);\nfor (const candidate of candidates) {\n  if (!candidate || typeof candidate.slug !== \"string\" || candidate.slug === \"none\") continue;\n  candidateState[candidate.slug] = {\n    title: candidate.title,\n    summary: candidate.summary\n  };\n}\nif (Object.keys(candidateState).length === 0) return null;\nreturn {\n  ticket: {\n    subject,\n    body,\n    customerPlan: ticket.customerPlan\n  },\n  candidates: candidateState\n};",
  "decide_js": "if (!answers || !answers.article || answers.article.type !== \"choice\") return \"none\";\nconst selected = answers.article.choice;\nif (selected === \"none\" || typeof selected !== \"string\") return \"none\";\nconst candidates = Array.isArray(input && input.candidates) ? input.candidates : [];\nfor (const candidate of candidates) {\n  if (candidate && candidate.slug === selected) return \"suggest\";\n}\nreturn \"none\";",
  "notes": "The decision model chooses one named retrieved article or none by judging whether the article directly answers the ticket, while JavaScript retains retrieval as an input, excludes empty inputs, validates the returned choice against the candidate slugs, and maps a valid article to suggest and every other outcome to none. No similarity threshold is used; the explicit none choice is the model's no-match outcome."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "ticket": {
        "subject": "How do I add a teammate?",
        "body": "I want my colleague to see the same dashboards. Where do I invite them?",
        "customerPlan": "pro"
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
      "article": {
        "type": "choice",
        "choice": "invite-users",
        "probabilities": {
          "none": 0,
          "sso-setup": 0,
          "invite-users": 1,
          "share-dashboard-link": 0
        },
        "confidence": 0.99
      }
    },
    "action": "suggest",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "ticket": {
        "subject": "Wrong VAT on invoice",
        "body": "Our invoice shows 20% VAT but we are registered in Germany.",
        "customerPlan": "enterprise"
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
      "article": {
        "type": "choice",
        "choice": "none",
        "probabilities": {
          "invite-users": 0,
          "none": 1,
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
