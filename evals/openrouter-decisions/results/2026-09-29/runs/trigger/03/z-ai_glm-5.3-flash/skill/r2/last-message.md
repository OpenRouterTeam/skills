I’ll map the failure pattern and choose the safest routing fix.

**Diagnosis**
- Keyword maps only catch surface words; customers rarely use billing vocabulary.
- Intent signals like “took money,” “twice,” “charged,” “payment,” “refund,” or “double” imply billing even without “invoice”/“charge.”
- Routing needs a bounded intent decision, not open-ended text generation.

**Plan**
1. Collect misrouted examples and label each as billing, engineering, or support.
2. Replace raw keyword matching with an intent classification step that returns routing probabilities/confidence.
3. Define decision thresholds: high-confidence intents route automatically; low-confidence cases escalate or send to general support.
4. Keep a small vocabulary fallback for fast, obvious cases, but make classifier output override ambiguous keyword behavior.
5. Add regression cases, especially paraphrases like “you took money from me twice,” and monitor route corrections.

**Recommended approach**
- Use a decision/classification model that outputs probabilities rather than free-form routing text.
- Route based on whether the billing probability crosses a threshold, rather than asking the model to “choose” a department.
- Preserve human review or support fallback for ties and uncertain cases.

This is exactly where OpenRouter’s Decisions API fits: it can score whether a customer message is billing versus support, and the router can act on the returned probability threshold instead of relying on brittle keywords.