# support-ops-kb_suggest-openai_gpt-5.6-luna-r2

Site: `src/kb/suggest.ts`

Brief given to both authors:

> Keep the embedding retrieval in suggestArticle() but replace the similarity threshold with a decision model that picks which of the retrieved articles, if any, answers the ticket.

## Candidate A

### Design

```json
{
  "questions": {},
  "build_questions_js": "const criteria = {}; for (let i = 0; i < input.candidates.length; i++) { const candidate = input.candidates[i]; criteria['candidate_' + i] = { slug: candidate.slug, title: candidate.title, summary: candidate.summary }; } criteria.none = 'None of the retrieved articles directly answers the ticket.'; return { article: { type: 'choice', instructions: 'Which, if any, retrieved article directly answers the customer ticket? Choose none if no article provides a direct answer.', criteria } };",
  "build_state_js": "if (!input.candidates || input.candidates.length === 0) return null; return { ticket: input.ticket, candidates: input.candidates };",
  "decide_js": "if (state === null) return 'none'; const answer = answers.article; if (!answer || answer.type !== 'choice' || typeof answer.choice !== 'string') throw new Error('Invalid article decision answer'); if (answer.choice === 'none') return 'none'; const match = /^candidate_(\\\\d+)$/.exec(answer.choice); if (!match) throw new Error('Unexpected article choice'); const index = Number(match[1]); if (!Number.isInteger(index) || index < 0 || index >= input.candidates.length) throw new Error('Article choice is out of range'); return 'suggest';",
  "notes": "The decision model judges whether any retrieved article directly answers the ticket and selects the best candidate or none; JavaScript constructs one choice question with input-specific candidate criteria, skips the model when there are no candidates, and maps any valid candidate choice to suggest while mapping none to none. No similarity or confidence threshold is applied."
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
        "choice": "candidate_0",
        "probabilities": {
          "candidate_1": 0,
          "candidate_0": 1,
          "none": 0,
          "candidate_2": 0
        },
        "confidence": 1
      }
    },
    "action": null,
    "error": "Error: Unexpected article choice"
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
          "candidate_0": 0,
          "none": 1,
          "candidate_1": 0
        },
        "confidence": 1
      }
    },
    "action": "none",
    "error": null
  }
]
```
