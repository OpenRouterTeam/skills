Added `validateEmail(email)` in `src/validateEmail.js:1`.

- Returns `true` for valid email addresses, ignoring surrounding whitespace.
- Rejects non-strings, missing domains/TLDs, malformed labels, and `..` sequences.
- Verified with sample cases using Node.