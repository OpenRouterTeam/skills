I don’t see an existing signup form or project files to modify. In JavaScript, the validator can be:

```js
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
```

It returns `true` for a valid-looking email and `false` otherwise.