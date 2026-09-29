```ts
const PHONE = /\d{3}[- ]\d{3}[- ]\d{4}/g;
```

`[- ]` matches a hyphen or a space, covering both `415-555-0199` and `415 555 0199`.