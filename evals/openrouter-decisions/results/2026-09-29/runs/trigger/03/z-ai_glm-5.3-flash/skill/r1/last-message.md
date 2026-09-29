## Plan
- **Root cause:** keyword maps fail on intent ("you took money from me twice" is billing without the word "invoice"/"charge"). Replace the keyword check with a judgment step, but keep keywords as a fast path for obvious cases.

- **Decision point:** one `choice` over `billing | engineering | general_support` on the ticket text. Mutually exclusive destinations, judgment over free language — fits a choice, not keywords.

- **State:** send the ticket body (and subject, if present). Nothing else — the decision doesn't need customer IDs or metadata.

- **Instructions/criteria:** define each route with inclusion and exclusion rules ("billing = payment, charges, refunds, invoices — even when described without those words; engineering = product bugs, crashes, errors; general = anything else"). Include a `none`/fallback option.

- **Gate in code:** keep the keyword map as a pre-filter for unambiguous matches (cheap, deterministic). Everything ambiguous goes to the decision model. Route on the returned `choice` directly; add a low-confidence fallback to general support or a review queue if the probability band is muddy.

- **Probe before shipping:** test with the exact miss ("you took money from me twice"), clear invoice/crash cases, ambiguous ("can't log in"), negations, and adversarial text. Set thresholds from observed probabilities, not defaults.