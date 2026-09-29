Added a standalone decision-model gate. It blocks auto-merge when `P(breaking) >= 0.5`, or when input/API validation fails.

The question sent is:

> Is this change breaking for existing users? Use only `pr.description` as evidence about the change.

The full criteria distinguish incompatibility from “No breaking changes” and template headings.

Verified with nine live probe cases and passing local tests.

No merge workflow existed here. Run the gate before your merge step:

```sh
npm run --silent gate < pr-description.txt
```

Exit `0` permits continuation; exit `1` blocks. See [README.md](README.md) for integration details.