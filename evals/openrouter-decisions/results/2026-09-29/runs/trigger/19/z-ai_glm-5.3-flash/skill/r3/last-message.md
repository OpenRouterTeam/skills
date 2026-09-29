```ts
const PHONE = /\d{3}[- ]\d{3}[- ]\d{4}/g;
```

This matches both `415-555-0199` and `415 555 0199`. If you also want no separator or dot-separated forms, use `/\\d{3}[-. ]?\\d{3}[-. ]?\\d{4}/g`.