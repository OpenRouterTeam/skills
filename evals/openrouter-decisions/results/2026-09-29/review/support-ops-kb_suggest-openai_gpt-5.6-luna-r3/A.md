# support-ops-kb_suggest-openai_gpt-5.6-luna-r3

Site: `src/kb/suggest.ts`

Brief given to both authors:

> Keep the embedding retrieval in suggestArticle() but replace the similarity threshold with a decision model that picks which of the retrieved articles, if any, answers the ticket.

## Candidate A

### Design

```json
{
  "questions": {},
  "build_questions_js": "const criteria = {};\nfor (const candidate of input.candidates) {\n  criteria[candidate.slug] = `Recommend this article only if it directly answers the ticket. Title: ${String(candidate.title)}. Summary: ${String(candidate.summary)}`;\n}\ncriteria.__none__ = \"No candidate directly answers the ticket.\";\nreturn {\n  recommendation: {\n    type: \"choice\",\n    instructions: \"Choose the single candidate article that best answers the ticket. Choose __none__ when none of the candidates directly answers it. Return only the option that is best supported by the ticket and article content.\",\n    criteria\n  }\n};",
  "build_state_js": "if (!input.candidates || input.candidates.length === 0) return null;\nreturn {\n  ticket: input.ticket,\n  candidates: input.candidates\n};",
  "decide_js": "const answer = answers && answers.recommendation;\nif (!answer || answer.type !== \"choice\" || typeof answer.choice !== \"string\") return \"none\";\nif (answer.choice === \"__none__\") return \"none\";\nconst candidate = (input.candidates || []).find((item) => item.slug === answer.choice);\nreturn candidate ? \"suggest\" : \"none\";",
  "notes": "The decision model compares the ticket with each retrieved article and chooses the best matching article or the explicit __none__ option. The JavaScript skips the model when there are no candidates, validates that the response is a choice for an actual candidate, and returns suggest only for a valid candidate; otherwise it returns none. No embedding similarity threshold is used."
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
      "recommendation": {
        "type": "choice",
        "choice": "invite-users",
        "probabilities": {
          "sso-setup": 0,
          "share-dashboard-link": 0,
          "__none__": 0,
          "invite-users": 1
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
      "recommendation": {
        "type": "choice",
        "choice": "__none__",
        "probabilities": {
          "__none__": 1,
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
