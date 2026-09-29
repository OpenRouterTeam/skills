Use a character class to allow spaces (or hyphens) between the groups:

```ts
const PHONE = /\d{3}[ -]\d{3}[ -]\d{4}/g;
```

This matches `415 555 0199`, `415-555-0199`, and still plain digit strings if you also want those:

```ts
const PHONE = /\d{3}[ -]?\d{3}[ -]?\d{4}/g;
```