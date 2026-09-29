# support-ops-leads_route-openai_gpt-5.6-luna-r1

Site: `src/leads/route.ts`

Brief given to both authors:

> Replace the keyword if-chain in routeLead() with a decision model, keeping the same team outputs and the existing source and employee-count rules.

## Candidate A

### Design

```json
{
  "questions": {
    "has_api": {
      "type": "noul",
      "instructions": "Does the message contain the exact case-insensitive substring \"api\"? Do not infer synonyms or related wording.",
      "criteria": {
        "true": "The exact substring appears in the message.",
        "false": "The exact substring does not appear in the message."
      }
    },
    "has_sdk": {
      "type": "noul",
      "instructions": "Does the message contain the exact case-insensitive substring \"sdk\"? Do not infer synonyms or related wording.",
      "criteria": {
        "true": "The exact substring appears in the message.",
        "false": "The exact substring does not appear in the message."
      }
    },
    "has_integration": {
      "type": "noul",
      "instructions": "Does the message contain the exact case-insensitive substring \"integration\"? Do not infer synonyms or related wording.",
      "criteria": {
        "true": "The exact substring appears in the message.",
        "false": "The exact substring does not appear in the message."
      }
    },
    "has_reseller": {
      "type": "noul",
      "instructions": "Does the message contain the exact case-insensitive substring \"reseller\"? Do not infer synonyms or related wording such as \"resell\".",
      "criteria": {
        "true": "The exact substring appears in the message.",
        "false": "The exact substring does not appear in the message."
      }
    },
    "has_partner": {
      "type": "noul",
      "instructions": "Does the message contain the exact case-insensitive substring \"partner\"? Do not infer synonyms or related wording.",
      "criteria": {
        "true": "The exact substring appears in the message.",
        "false": "The exact substring does not appear in the message."
      }
    },
    "has_white_label": {
      "type": "noul",
      "instructions": "Does the message contain the exact case-insensitive substring \"white label\"? Do not infer synonyms or related wording.",
      "criteria": {
        "true": "The exact substring appears in the message.",
        "false": "The exact substring does not appear in the message."
      }
    },
    "has_enterprise": {
      "type": "noul",
      "instructions": "Does the message contain the exact case-insensitive substring \"enterprise\"? Do not infer synonyms or related wording.",
      "criteria": {
        "true": "The exact substring appears in the message.",
        "false": "The exact substring does not appear in the message."
      }
    },
    "has_procurement": {
      "type": "noul",
      "instructions": "Does the message contain the exact case-insensitive substring \"procurement\"? Do not infer synonyms or related wording.",
      "criteria": {
        "true": "The exact substring appears in the message.",
        "false": "The exact substring does not appear in the message."
      }
    },
    "has_security_review": {
      "type": "noul",
      "instructions": "Does the message contain the exact case-insensitive substring \"security review\"? Do not infer synonyms or related wording.",
      "criteria": {
        "true": "The exact substring appears in the message.",
        "false": "The exact substring does not appear in the message."
      }
    },
    "has_pricing": {
      "type": "noul",
      "instructions": "Does the message contain the exact case-insensitive substring \"pricing\"? Do not infer synonyms or related wording.",
      "criteria": {
        "true": "The exact substring appears in the message.",
        "false": "The exact substring does not appear in the message."
      }
    },
    "has_trial": {
      "type": "noul",
      "instructions": "Does the message contain the exact case-insensitive substring \"trial\"? Do not infer synonyms or related wording.",
      "criteria": {
        "true": "The exact substring appears in the message.",
        "false": "The exact substring does not appear in the message."
      }
    },
    "has_demo": {
      "type": "noul",
      "instructions": "Does the message contain the exact case-insensitive substring \"demo\"? Do not infer synonyms or related wording.",
      "criteria": {
        "true": "The exact substring appears in the message.",
        "false": "The exact substring does not appear in the message."
      }
    }
  },
  "build_questions_js": null,
  "build_state_js": "if (input.source === \"partner\" || (input.employees !== null && input.employees >= 1000)) return null;\nreturn { message: input.message };",
  "decide_js": "if (input.source === \"partner\") return \"partnerships\";\nif (input.employees !== null && input.employees >= 1000) return \"enterprise\";\nfunction yes(key) {\n  var answer = answers[key];\n  if (!answer || answer.type !== \"noul\" || typeof answer.noul !== \"number\") throw new Error(\"Invalid decision answer: \" + key);\n  return answer.noul >= 0.5;\n}\nif (yes(\"has_api\") || yes(\"has_sdk\") || yes(\"has_integration\")) return \"developer_relations\";\nif (yes(\"has_reseller\") || yes(\"has_partner\") || yes(\"has_white_label\")) return \"partnerships\";\nif (yes(\"has_enterprise\") || yes(\"has_procurement\") || yes(\"has_security_review\")) return \"enterprise\";\nif (yes(\"has_pricing\") || yes(\"has_trial\") || yes(\"has_demo\")) return \"smb\";\nreturn \"general_inbox\";",
  "notes": "The Decisions API judges whether the message contains each exact case-insensitive routing substring without inferring synonyms; JavaScript applies the original precedence: partner source first, then at least 1,000 employees, then developer, partnerships, enterprise, SMB, and finally the general inbox. Inputs resolved by the source or employee rules skip the model entirely, and noul probabilities of at least 0.5 are treated as true."
}
```

### Behaviour on the sample inputs

```json
[
  {
    "skipped_model": false,
    "state": {
      "message": "We want to embed your reporting in our own product and resell it to our customers under our brand."
    },
    "answers": {
      "has_api": {
        "type": "noul",
        "noul": 0.05
      },
      "has_sdk": {
        "type": "noul",
        "noul": 0.04
      },
      "has_integration": {
        "type": "noul",
        "noul": 0.05
      },
      "has_reseller": {
        "type": "noul",
        "noul": 0.04
      },
      "has_partner": {
        "type": "noul",
        "noul": 0.04
      },
      "has_white_label": {
        "type": "noul",
        "noul": 0.05
      },
      "has_enterprise": {
        "type": "noul",
        "noul": 0.04
      },
      "has_procurement": {
        "type": "noul",
        "noul": 0.03
      },
      "has_security_review": {
        "type": "noul",
        "noul": 0.03
      },
      "has_pricing": {
        "type": "noul",
        "noul": 0.04
      },
      "has_trial": {
        "type": "noul",
        "noul": 0.04
      },
      "has_demo": {
        "type": "noul",
        "noul": 0.05
      }
    },
    "action": "general_inbox",
    "error": null
  },
  {
    "skipped_model": false,
    "state": {
      "message": "Hi, how do I authenticate against the REST endpoints from a Node service? Docs are unclear."
    },
    "answers": {
      "has_api": {
        "type": "noul",
        "noul": 0.07
      },
      "has_sdk": {
        "type": "noul",
        "noul": 0.04
      },
      "has_integration": {
        "type": "noul",
        "noul": 0.04
      },
      "has_reseller": {
        "type": "noul",
        "noul": 0.04
      },
      "has_partner": {
        "type": "noul",
        "noul": 0.04
      },
      "has_white_label": {
        "type": "noul",
        "noul": 0.02
      },
      "has_enterprise": {
        "type": "noul",
        "noul": 0.04
      },
      "has_procurement": {
        "type": "noul",
        "noul": 0.02
      },
      "has_security_review": {
        "type": "noul",
        "noul": 0.03
      },
      "has_pricing": {
        "type": "noul",
        "noul": 0.03
      },
      "has_trial": {
        "type": "noul",
        "noul": 0.05
      },
      "has_demo": {
        "type": "noul",
        "noul": 0.05
      }
    },
    "action": "general_inbox",
    "error": null
  },
  {
    "skipped_model": true,
    "state": null,
    "answers": {},
    "action": "partnerships",
    "error": null
  }
]
```
