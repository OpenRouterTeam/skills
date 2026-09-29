# support-ops-kb_suggest-openai_gpt-5.6-luna-r2

Site: `src/kb/suggest.ts`

Brief given to both authors:

> Keep the embedding retrieval in suggestArticle() but replace the similarity threshold with a decision model that picks which of the retrieved articles, if any, answers the ticket.

## Candidate B

### Design

```json
{
  "questions": {},
  "build_questions_js": "const criteria = {}; for (const candidate of input.candidates || []) { criteria[candidate.slug] = `The article identified by the option key ${JSON.stringify(candidate.slug)} directly answers the customer's request in the ticket. Use the article's title and summary in state to judge whether it provides the needed instructions or resolution.`; } criteria.none = 'None of the candidate articles directly answers the customer\\'s request.'; return { article: { type: 'choice', instructions: 'Which, if any, candidate knowledge-base article directly answers the customer\\'s ticket? Judge whether the article addresses the customer\\'s actual request, not merely whether it shares a keyword or general topic. Choose none when no candidate is a direct answer.', criteria } };",
  "build_state_js": "const candidates = Array.isArray(input.candidates) ? input.candidates : []; if (!input.ticket || candidates.length === 0) return null; return { ticket: { subject: input.ticket.subject || '', body: input.ticket.body || '', customerPlan: input.ticket.customerPlan || '' }, candidates: Object.fromEntries(candidates.map(candidate => [candidate.slug, { title: candidate.title || '', summary: candidate.summary || '' }])) };",
  "decide_js": "if (!answers || !answers.article || answers.article.type !== 'choice') return 'none'; const selected = answers.article.choice; if (selected === 'none' || !state || !state.candidates || !Object.prototype.hasOwnProperty.call(state.candidates, selected)) return 'none'; return 'suggest';",
  "notes": "The decision model judges which named retrieved article, if any, directly answers the ticket; the candidate options and their titles and summaries are built per input, with an explicit none option. Embedding retrieval and ranking remain outside this decision request. Code skips the model when there are no candidates or no ticket, validates the returned choice, and returns suggest for any valid article choice or none otherwise. No similarity threshold is used."
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
          "invite-users": 1,
          "none": 0,
          "sso-setup": 0,
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
