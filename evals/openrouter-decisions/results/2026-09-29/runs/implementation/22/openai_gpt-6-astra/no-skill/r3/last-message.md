Added `breaking_gate.py` using Jev’s Noul decision model.

The question sent is:

> Does pr_description state that this PR introduces a breaking change?

Auto-merge passes only when the probability of “yes” is below 0.10. Uncertainty, empty descriptions, and API errors hold for review. The threshold needs calibration.

Preview the full request:
```sh
python breaking_gate.py pr-description.md --dry-run
```

Five tests pass. No existing auto-merge configuration was present, so integration remains unwired.