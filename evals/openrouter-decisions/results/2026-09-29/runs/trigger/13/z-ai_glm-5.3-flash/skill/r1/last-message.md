Added `validateEmail.cjs:1`, a CommonJS email validator for the signup form.

- Returns `true` for valid addresses such as `user@example.com` and `a.b-c+tag@sub.example.co`.
- Rejects malformed local parts/domains, consecutive dots, missing TLDs, and non-string input.
- Verified with 10 representative cases; all passed.