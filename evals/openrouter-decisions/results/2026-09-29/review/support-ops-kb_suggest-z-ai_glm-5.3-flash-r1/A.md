# support-ops-kb_suggest-z-ai_glm-5.3-flash-r1

Site: `src/kb/suggest.ts`

Brief given to both authors:

> Keep the embedding retrieval in suggestArticle() but replace the similarity threshold with a decision model that picks which of the retrieved articles, if any, answers the ticket.

## Candidate A

### Design

```json
{
  "questions": {
    "best_article": {
      "type": "choice",
      "instructions": "Which of the retrieved knowledge base articles, if any, best answers the customer's ticket? Choose exactly one option.",
      "criteria": {}
    },
    "is_confident": {
      "type": "noul",
      "instructions": "Are you confident that the chosen article actually answers the customer's question or resolves their issue (not merely related)?",
      "criteria": {
        "true": "The article's title and summary directly address what the customer is asking about or the problem they describe.",
        "false": "The article is only tangentially related, covers a different topic, or no article is a good match."
      }
    }
  },
  "build_questions_js": "const criteria = {};\nfor (const c of input.candidates) {\n  criteria[c.slug] = { title: c.title, summary: c.summary };\n}\ncriteria.none = 'No retrieved article answers the ticket.';\nreturn { best_article: { type: 'choice', instructions: \"Which of the retrieved knowledge base articles, if any, best answers the customer's ticket? Choose exactly one option.\", criteria }, is_confident: { type: 'noul', instructions: \"Are you confident that the chosen article actually answers the customer's question or resolves their issue (not merely related)?\", criteria: { true: \"The article's title and summary directly address what the customer is asking about or the problem they describe.\", false: \"The article is only tangentially related, covers a different topic, or no article is a good match.\" } } };",
  "build_state_js": "return {\n  ticket: { id: input.ticket.id, subject: input.ticket.subject, body: input.ticket.body, customerPlan: input.ticket.customerPlan },\n  candidates: input.candidates.map((c, i) => ({ position: i + 1, slug: c.slug, title: c.title, summary: c.summary }))\n};",
  "decide_js": "const best = answers.best_article;\nif (!best || best.type !== 'choice') return 'none';\nconst choice = best.choice;\nif (!choice || choice === 'none') return 'none';\nconst conf = answers.is_confident;\nif (!conf || conf.type !== 'noul') return 'none';\nif (conf.noul < 0.5) return 'none';\nconst probs = best.probabilities || {};\nconst p = typeof probs[choice] === 'number' ? probs[choice] : 0;\nif (p < 0.5) return 'none';\nreturn 'suggest';",
  "notes": "The embedding retrieval still narrows the corpus to the top candidates; the decision model then judges which candidate, if any, actually answers the ticket. build_questions_js builds the choice criteria dynamically from input.candidates (slug -> {title, summary}) plus a 'none' escape option, and adds a noul question asking whether the chosen article truly resolves the ticket rather than merely being related. build_state_js passes the ticket and the ordered candidate list so the model can reason over both. decide_js validates answer types (treating missing keys or unexpected types as errors per the API contract, returning 'none' rather than guessing), maps the chosen slug to 'suggest' unless it is the 'none' option, and applies two safety thresholds: the noul confidence must be at least 0.5 and the chosen option's probability at least 0.5; otherwise it returns 'none'. These thresholds replace the old cosine similarity cutoff of 0.78."
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
          "position": 1,
          "slug": "invite-users",
          "title": "Inviting users to your workspace",
          "summary": "Add teammates from Settings, assign roles, and resend invitations."
        },
        {
          "position": 2,
          "slug": "share-dashboard-link",
          "title": "Sharing a dashboard by link",
          "summary": "Create a read-only public link to a single dashboard."
        },
        {
          "position": 3,
          "slug": "sso-setup",
          "title": "Setting up SSO",
          "summary": "Configure SAML with Okta or Azure AD on enterprise plans."
        }
      ]
    },
    "answers": {
      "best_article": {
        "type": "choice",
        "choice": "invite-users",
        "probabilities": {
          "invite-users": 1,
          "share-dashboard-link": 0,
          "sso-setup": 0,
          "none": 0
        },
        "confidence": 1
      },
      "is_confident": {
        "type": "noul",
        "noul": 0.94
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
          "position": 1,
          "slug": "invite-users",
          "title": "Inviting users to your workspace",
          "summary": "Add teammates from Settings, assign roles, and resend invitations."
        },
        {
          "position": 2,
          "slug": "sso-setup",
          "title": "Setting up SSO",
          "summary": "Configure SAML with Okta or Azure AD on enterprise plans."
        }
      ]
    },
    "answers": {
      "best_article": {
        "type": "choice",
        "choice": "none",
        "probabilities": {
          "none": 1,
          "invite-users": 0,
          "sso-setup": 0
        },
        "confidence": 1
      },
      "is_confident": {
        "type": "noul",
        "noul": 0.02
      }
    },
    "action": "none",
    "error": null
  }
]
```
