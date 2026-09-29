Created `validate_email.py:10`.

- `is_valid_signup_email()` returns `bool` safely for non-string inputs.
- Validates local part, domain labels, maximum email length, and rejects malformed cases.
- Usage: `is_valid_signup_email("user@example.com")`.
- Included assertion-based examples; they pass.