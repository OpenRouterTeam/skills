# marketplace-ops-sellers_onboarding-z-ai_glm-5.3-flash-r3

Site: `src/sellers/onboarding.ts`

Brief given to both authors:

> Change screenApplication() so verified applications outside restricted categories are approved or rejected from the description (a real business selling permitted goods is approved; a restricted or misrepresented business is rejected), with review only for unclear cases.

## Candidate A

### Design

```json
{
  "questions": {
    "verdict": {
      "type": "choice",
      "instructions": "Based on the seller's stated business, is this a genuine business selling permitted goods that should be approved, a restricted or misrepresented business that should be rejected, or is the information insufficient to decide?\n\nWhat counts as genuine: a concrete, plausible business activity that matches the business name and mentions what is sold, made, or served, and who the customers are.\n\nWhat looks similar but is not genuine: purely generic or template-like descriptions with no identifiable business ('we sell quality products at great prices'), descriptions that contradict the business name or listed categories, resale schemes for tickets or event access, and businesses dealing in tobacco, alcohol, pharmaceuticals, weapons, or gambling, including descriptions that hint at these while claiming something innocuous.",
      "criteria": {
        "legitimate": "A real, specific business selling permitted goods or services, consistent with its name, description, and categories.",
        "problematic": "The business deals in restricted goods (tobacco, alcohol, pharmacy, weapons, gambling), is a resale or arbitrage front such as ticket reselling, contradicts itself, or the description is boilerplate suggesting no real business exists.",
        "unclear": "There is not enough specific information to judge either way."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "// Hard code-side rules settled before the model: incomplete verification or a restricted\ncategory is an automatic reject, so no judgment is needed.\nif (!input.identityVerified || !input.bankVerified) return null;\nvar RESTRICTED = ['tobacco','alcohol','pharmacy','weapons','gambling'];\nfor (var i = 0; i < input.categories.length; i++) {\n  if (RESTRICTED.indexOf(input.categories[i]) !== -1) return null;\n}\n// Only what the question reads: the claimed business and its context.\nreturn {\n  business_name: input.businessName,\n  description: input.description,\n  categories: input.categories,\n  country: input.country\n};",
  "decide_js": "var APPROVE_THRESHOLD = 0.70; // confident the business is genuine -> auto-approve\nvar REJECT_THRESHOLD = 0.65;  // confident it is restricted/misrepresented -> auto-reject\n                              // anything between falls to human review\nvar v = answers.verdict;\nif (!v || v.type !== 'choice') return 'review';\nvar probs = v.probabilities || {};\nvar bad = typeof probs.problematic === 'number' ? probs.problematic : 0;\nvar legit = typeof probs.legitimate === 'number' ? probs.legitimate : 0;\n// Reject checked first: wrongly approving a restricted or fake seller is the costly\n// mistake, so ties lean toward review rather than approval.\nif (bad >= REJECT_THRESHOLD) return 'reject';\nif (legit >= APPROVE_THRESHOLD) return 'approve';\n// Fallback if probabilities are ever absent: take the argmax choice.\nif (!probs || Object.keys(probs).length === 0) {\n  if (v.choice === 'legitimate') return 'approve';\n  if (v.choice === 'problematic') return 'reject';\n  return 'review';\n}\nreturn 'review';",
  "notes": "Code keeps the deterministic rules: failed identity/bank verification and any restricted category return 'reject' immediately, implemented by having build_state_js return null so no model call happens for those inputs. Everything else gets one Decisions request carrying only the fields the question reads (business name, description, categories, country); verification flags and the restriction check feed code rules, not the model. The model makes one judgment: a three-way choice between a genuine permitted business, a restricted/misrepresented/front business (including boilerplate-with-no-business and ticket reselling), and genuinely unclear cases, with the instructions spelling out what looks similar but disqualifies. In decide_js, probabilities drive the gate: problematic >= 0.65 rejects, legitimate >= 0.70 approves, and anything in between routes to human review, preserving the existing reviewer path for uncertain cases. These thresholds are starting values pending a probe over representative inputs (clear approvals, clear fakes/dropshippers, boilerplate, borderline craft shops, adversarial descriptions arguing for legitimacy); the reject branch is tested first because approving a prohibited seller is the expensive error, and the wide middle band keeps reviewers focused on the ~15% that previously justified manual screening."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": null,
    "answers": {},
    "action": null,
    "error": "Unexpected identifier 'is'"
  },
  {
    "skipped_model": false,
    "state": null,
    "answers": {},
    "action": null,
    "error": "Unexpected identifier 'is'"
  },
  {
    "skipped_model": false,
    "state": null,
    "answers": {},
    "action": null,
    "error": "Unexpected identifier 'is'"
  }
]
```
