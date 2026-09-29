No application source file containing `PHONE` exists in the workspace. The corrected regex is:

```ts
const PHONE = /\d{3}(?:-\d{3}-|\s\d{3}\s)\d{4}/g;
```

It matches both `415-555-0199` and `415 555 0199`.