# Authentication Reference

> Read this when you need to implement OAuth PKCE flow for user-facing apps, manage API keys programmatically, or review security best practices.

## Table of Contents

- [API Key Management](#api-key-management)
- [OAuth Authentication (PKCE Flow)](#oauth-authentication-pkce-flow)
- [Complete OAuth Flow Example](#complete-oauth-flow-example)
- [Security Best Practices](#security-best-practices)

---

## API Key Management

### Get Current Key Metadata

Retrieve information about the currently configured API key:

```typescript
const keyInfo = await client.apiKeys.getCurrentKeyMetadata();
console.log('Key name:', keyInfo.name);
console.log('Created:', keyInfo.createdAt);
```

### Programmatic Key Management

```typescript
// List all keys
const keys = await client.apiKeys.list();

// Create a new key
const newKey = await client.apiKeys.create({
  name: 'Production API Key'
});

// Get a specific key by hash
const key = await client.apiKeys.get({
  hash: 'sk-or-v1-...'
});

// Update a key
await client.apiKeys.update({
  hash: 'sk-or-v1-...',
  requestBody: {
    name: 'Updated Key Name'
  }
});

// Delete a key
await client.apiKeys.delete({
  hash: 'sk-or-v1-...'
});
```

---

## OAuth Authentication (PKCE Flow)

For user-facing applications where users should control their own API keys, OpenRouter supports OAuth with PKCE (Proof Key for Code Exchange). This flow allows users to generate API keys through a browser authorization flow without your application handling their credentials.

### createAuthCode

Generate an authorization code and URL to start the OAuth flow:

```typescript
const authResponse = await client.oAuth.createAuthCode({
  callbackUrl: 'https://myapp.com/auth/callback'
});

// authResponse contains:
// - authorizationUrl: URL to redirect the user to
// - code: The authorization code for later exchange

console.log('Redirect user to:', authResponse.authorizationUrl);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `callbackUrl` | `string` | Yes | Your application's callback URL after user authorization |

**Browser Redirect:**

```typescript
// In a browser environment
window.location.href = authResponse.authorizationUrl;

// Or in a server-rendered app, return a redirect response
res.redirect(authResponse.authorizationUrl);
```

### exchangeAuthCodeForAPIKey

After the user authorizes your application, they are redirected back to your callback URL with an authorization code. Exchange this code for an API key:

```typescript
// In your callback handler
const code = req.query.code;  // From the redirect URL

const apiKeyResponse = await client.oAuth.exchangeAuthCodeForAPIKey({
  code: code
});

// apiKeyResponse contains:
// - key: The user's API key
// - Additional metadata about the key

const userApiKey = apiKeyResponse.key;

// Store securely for this user's future requests
await saveUserApiKey(userId, userApiKey);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | `string` | Yes | The authorization code from the OAuth redirect |

---

## Complete OAuth Flow Example

```typescript
import OpenRouter from '@openrouter/sdk';
import express from 'express';

const app = express();
const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY  // Your app's key for OAuth operations
});

// Step 1: Initiate OAuth flow
app.get('/auth/start', async (req, res) => {
  const authResponse = await client.oAuth.createAuthCode({
    callbackUrl: 'https://myapp.com/auth/callback'
  });

  // Store any state needed for the callback
  req.session.oauthState = { /* ... */ };

  // Redirect user to OpenRouter authorization page
  res.redirect(authResponse.authorizationUrl);
});

// Step 2: Handle callback and exchange code
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Authorization code missing');
  }

  try {
    const apiKeyResponse = await client.oAuth.exchangeAuthCodeForAPIKey({
      code: code as string
    });

    // Store the user's API key securely
    await saveUserApiKey(req.session.userId, apiKeyResponse.key);

    res.redirect('/dashboard?auth=success');
  } catch (error) {
    console.error('OAuth exchange failed:', error);
    res.redirect('/auth/error');
  }
});

// Step 3: Use the user's API key for their requests
app.post('/api/chat', async (req, res) => {
  const userApiKey = await getUserApiKey(req.session.userId);

  // Create a client with the user's key
  const userClient = new OpenRouter({
    apiKey: userApiKey
  });

  const result = userClient.callModel({
    model: 'openai/gpt-5-nano',
    input: req.body.message
  });

  const text = await result.getText();
  res.json({ response: text });
});
```

---

## Security Best Practices

1. **Environment Variables**: Store API keys in environment variables, never in code
2. **Key Rotation**: Rotate keys periodically using the key management API
3. **Environment Separation**: Use different keys for development, staging, and production
4. **OAuth for Users**: Use the OAuth PKCE flow for user-facing apps to avoid handling user credentials
5. **Secure Storage**: Store user API keys encrypted in your database
6. **Minimal Scope**: Create keys with only the permissions needed
