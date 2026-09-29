# support-ops-kb_suggest-z-ai_glm-5.3-flash-r1

Site: `src/kb/suggest.ts`

Brief given to both authors:

> Keep the embedding retrieval in suggestArticle() but replace the similarity threshold with a decision model that picks which of the retrieved articles, if any, answers the ticket.

## Candidate B

### Design

```json
{
  "questions": {},
  "build_questions_js": "var MAX_CANDIDATES = 12;\nvar cands = (input.candidates || []).slice(0, MAX_CANDIDATES);\nif (cands.length === 0) {\n  return {};\n}\nvar criteria = {};\nfor (var i = 0; i < cands.length; i++) {\n  var c = cands[i];\n  criteria[c.slug] = \"The article titled '\" + String(c.title) + \"' answers the support ticket.\";\n}\ncriteria.none = \"None of the listed articles answers the support ticket.\";\nreturn {\n  best_match: {\n    type: \"choice\",\n    instructions: \"Which of the listed knowledge-base articles, if any, actually answers the support ticket? Judge whether following the article would resolve what the customer is asking about, not merely whether the topic overlaps.\",\n    criteria: criteria\n  }\n};",
  "build_state_js": "var t = input.ticket || {};\nvar cands = input.candidates || [];\nif (!Array.isArray(cands) || cands.length === 0) {\n  return null;\n}\nvar articles = {};\nfor (var i = 0; i < cands.length; i++) {\n  var c = cands[i];\n  articles[String(c.slug)] = { title: String(c.title), summary: String(c.summary) };\n}\nreturn {\n  ticket_subject: String(t.subject == null ? \"\" : t.subject),\n  ticket_body: String(t.body == null ? \"\" : t.body),\n  articles: articles\n};",
  "decide_js": "var ans = answers.best_match;\nif (!ans || ans.type !== \"choice\") {\n  return \"none\";\n}\nvar pick = ans.choice;\nif (!pick || pick === \"none\") {\n  return \"none\";\n}\nvar cands = input.candidates || [];\nfor (var i = 0; i < cands.length; i++) {\n  if (String(cands[i].slug) === pick) {\n    return \"suggest\";\n  }\n}\nreturn \"none\";",
  "notes": "Code keeps everything computational: the embedding lookup, cosine similarity, sorting, and slicing to the top candidates all stay in suggestArticle(), and the hardcoded SUGGEST_THRESHOLD is deleted. The judgment left to the model is which retrieved article genuinely answers the ticket versus merely sharing keywords, so build_questions_js emits one choice question whose options are the runtime candidate slugs (plus a 'none' escape hatch), with each criterion naming its article by title. build_state_js sends only what the question reads — the ticket subject and body and the candidates keyed by slug with title and summary — and omits ids, plan tiers, embeddings, and similarity scores, since those feed no question; it returns null when there are no candidates, skipping the model entirely and letting decide_js fall straight through to 'none'. Candidates are capped at 12 to bound context size. decide_js trusts the choice field (the pre-probe default per the skill; once real probes show the probability gap between correct picks and 'none', a minimum-probability or confidence floor can be added as a named constant, with 'none' serving as the natural fallback band). It validates that the chosen slug exists in the input's candidates before returning 'suggest'; the suggested article itself is answers.best_match.choice, and the response's model string should be logged alongside it for traceability. Probe set should cover: a clearly-matching candidate, a topical-but-wrong distractor pair (like share-dashboard-link vs invite-users), tickets answered by none of the candidates, empty candidate lists, and summaries phrased differently from the ticket vocabulary."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "ticket_subject": "How do I add a teammate?",
      "ticket_body": "I want my colleague to see the same dashboards. Where do I invite them?",
      "articles": {
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
      "best_match": {
        "type": "choice",
        "choice": "invite-users",
        "probabilities": {
          "invite-users": 1,
          "share-dashboard-link": 0,
          "none": 0,
          "sso-setup": 0
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
      "ticket_subject": "Wrong VAT on invoice",
      "ticket_body": "Our invoice shows 20% VAT but we are registered in Germany.",
      "articles": {
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
      "best_match": {
        "type": "choice",
        "choice": "none",
        "probabilities": {
          "sso-setup": 0,
          "none": 1,
          "invite-users": 0
        },
        "confidence": 1
      }
    },
    "action": "none",
    "error": null
  }
]
```
