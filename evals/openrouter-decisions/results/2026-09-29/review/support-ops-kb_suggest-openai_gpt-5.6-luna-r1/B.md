# support-ops-kb_suggest-openai_gpt-5.6-luna-r1

Site: `src/kb/suggest.ts`

Brief given to both authors:

> Keep the embedding retrieval in suggestArticle() but replace the similarity threshold with a decision model that picks which of the retrieved articles, if any, answers the ticket.

## Candidate B

### Design

```json
{
  "questions": {},
  "build_questions_js": "const criteria = {};\nconst options = state && Array.isArray(state.options) ? state.options : [];\nfor (const option of options) {\n  criteria[option.id] = option.title + \": \" + option.summary;\n}\ncriteria.none = \"None of the listed articles directly answers the customer's ticket; related or insufficiently specific articles should not be selected.\";\nreturn {\n  article: {\n    type: \"choice\",\n    instructions: \"Which, if any, of these knowledge-base articles directly answers the customer's ticket? Choose none unless one article sufficiently answers the question or resolves the issue.\",\n    criteria\n  }\n};",
  "build_state_js": "const candidates = Array.isArray(input.candidates) ? input.candidates : [];\nif (candidates.length === 0) return null;\nreturn {\n  ticket: input.ticket,\n  options: candidates.map((candidate, index) => ({\n    id: \"article_\" + index,\n    slug: candidate.slug,\n    title: candidate.title,\n    summary: candidate.summary\n  }))\n};",
  "decide_js": "if (!answers || typeof answers !== \"object\") return \"none\";\nconst answer = answers.article;\nif (!answer || typeof answer !== \"object\" || answer.type !== \"choice\") return \"none\";\nif (typeof answer.choice !== \"string\") return \"none\";\nif (answer.choice === \"none\") return \"none\";\nconst options = state && Array.isArray(state.options) ? state.options : [];\nif (!options.some((option) => option && option.id === answer.choice)) return \"none\";\nif (Object.prototype.hasOwnProperty.call(answer, \"probabilities\")) {\n  if (!answer.probabilities || typeof answer.probabilities !== \"object\") return \"none\";\n  const probability = answer.probabilities[answer.choice];\n  if (typeof probability !== \"number\" || !Number.isFinite(probability) || probability < 0.5) return \"none\";\n}\nif (Object.prototype.hasOwnProperty.call(answer, \"confidence\")) {\n  if (typeof answer.confidence !== \"number\" || !Number.isFinite(answer.confidence) || answer.confidence < 0.5) return \"none\";\n}\nreturn \"suggest\";",
  "notes": "The decision model chooses among the retrieved candidates or none, using the ticket and each article's title and summary; it is instructed not to select merely related or insufficiently specific content. JavaScript skips the model when there are no candidates, validates the choice answer and candidate ID, and returns none for malformed or low-confidence results. When present, both the selected-choice probability and confidence must be at least 0.5."
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
      "options": [
        {
          "id": "article_0",
          "slug": "invite-users",
          "title": "Inviting users to your workspace",
          "summary": "Add teammates from Settings, assign roles, and resend invitations."
        },
        {
          "id": "article_1",
          "slug": "share-dashboard-link",
          "title": "Sharing a dashboard by link",
          "summary": "Create a read-only public link to a single dashboard."
        },
        {
          "id": "article_2",
          "slug": "sso-setup",
          "title": "Setting up SSO",
          "summary": "Configure SAML with Okta or Azure AD on enterprise plans."
        }
      ]
    },
    "answers": {
      "article": {
        "type": "choice",
        "choice": "article_0",
        "probabilities": {
          "article_1": 0,
          "article_0": 1,
          "article_2": 0,
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
      "options": [
        {
          "id": "article_0",
          "slug": "invite-users",
          "title": "Inviting users to your workspace",
          "summary": "Add teammates from Settings, assign roles, and resend invitations."
        },
        {
          "id": "article_1",
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
          "article_1": 0,
          "article_0": 0,
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
