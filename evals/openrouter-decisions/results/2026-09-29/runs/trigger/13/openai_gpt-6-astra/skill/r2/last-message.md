```javascript
function isValidEmail(email) {
  return (
    typeof email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}
```

Checks basic email format; it doesn’t verify that the mailbox exists.