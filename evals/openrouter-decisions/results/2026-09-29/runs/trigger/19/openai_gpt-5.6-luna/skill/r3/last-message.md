Use a character class for either hyphens or spaces:

```ts
const PHONE = /\d{3}[- ]\d{3}[- ]\d{4}/g;
```

This matches both `415-555-0199` and `415 555 0199`.