```javascript
function isValidEmail(value) {
  return (
    typeof value === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  );
}
```

This checks basic email format and returns a boolean. Confirming the address exists requires a verification email.