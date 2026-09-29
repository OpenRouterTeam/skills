Use a character class that accepts either separator:

```ts
const PHONE = /\d{3}[- ]\d{3}[- ]\d{4}/g;
```

This matches `415-555-0199` and `415 555 0199`. If you also need compact digits (`4155550199`), use:

```ts
const PHONE = /\d{3}[- ]?\d{3}[- ]?\d{4}/g;
```