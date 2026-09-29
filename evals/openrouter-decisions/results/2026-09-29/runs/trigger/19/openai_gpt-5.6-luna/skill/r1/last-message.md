The workspace doesn’t contain the detector file to edit. Update the regex to:

```ts
const PHONE = /\d{3}[- ]\d{3}[- ]\d{4}/g;
```

This matches both `415-555-0199` and `415 555 0199`.