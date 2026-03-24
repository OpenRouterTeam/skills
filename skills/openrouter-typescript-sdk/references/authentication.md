# Authentication Reference

## API Key Authentication

### Obtaining an API Key

1. Visit [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
2. Create a new API key
3. Store securely in an environment variable

### Environment Setup

```bash
export OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### Get Current Key Metadata

```typescript
const keyInfo = await client.apiKeys.getCurrentKeyMetadata();
console.log('Key name:', keyInfo.name);
console.log('Created:', keyInfo.createdAt);
```

### API Key Management

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

## OAuth Authentication (PKCE Flow)

For user-facing applications where users control their own API keys, OpenRouter supports OAuth with PKCE (Proof Key for Code Exchange).

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
| `callbackUrl` | `string` | Yes | Application callback URL after user authorization |

**Browser Redirect:**

```typescript
// In a browser environment
window.location.href = authResponse.authorizationUrl;

// Or in a server-rendered app, return a redirect response
res.redirect(authResponse.authorizationUrl);
```

### exchangeAuthCodeForAPIKey

After the user authorizes, exchange the code for an API key:

```typescript
const code = req.query.code;  // From the redirect URL

const apiKeyResponse = await client.oAuth.exchangeAuthCodeForAPIKey({
  code: code
});

const userApiKey = apiKeyResponse.key;
await saveUserApiKey(userId, userApiKey);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `code` | `string` | Yes | The authorization code from the OAuth redirect |

### Complete OAuth Flow Example

```typescript
import OpenRouter from '@openrouter/sdk';
import express from 'express';

const app = express();
const client = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY  // App's key for OAuth operations
});

// Step 1: Initiate OAuth flow
app.get('/auth/start', async (req, res) => {
  const authResponse = await client.oAuth.createAuthCode({
    callbackUrl: 'https://myapp.com/auth/callback'
  });

  req.session.oauthState = { /* ... */ };
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

## Security Best Practices

1. **Environment Variables**: Store API keys in environment variables, never in code
2. **Key Rotation**: Rotate keys periodically using the key management API
3. **Environment Separation**: Use different keys for development, staging, and production
4. **OAuth for Users**: Use the OAuth PKCE flow for user-facing apps
5. **Secure Storage**: Store user API keys encrypted in the database
6. **Minimal Scope**: Create keys with only the permissions needed
