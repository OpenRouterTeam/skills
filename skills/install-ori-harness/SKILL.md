---
name: install-ori-harness
description: Install Ori and run the user's existing coding agent CLI through Ori on OpenRouter, with OAuth sign-in, model selection, upgrades, and install verification.
---

# Install and run Ori Harness

Use this recipe when the user wants to install Ori, run an existing coding
agent through Ori, sign in to Ori, upgrade Ori, or select an OpenRouter model
for a local agent. Do not use it for model evaluations, plain unit tests, or
when the user only wants to run an already-installed agent directly without
Ori.

## 1. Install Ori

Run the official installer:

```sh
curl -fsSL https://openrouter.ai/labs/ori/install.sh | bash
```

The installer puts the `ori` executable in the user's local install location.
Do not use `sudo` unless the user explicitly chooses a system-wide install
location.

## 2. Verify the CLI

Run:

```sh
ori --version
```

The command must print a version and exit successfully. If the shell cannot
find `ori`, inspect the installer's reported directory and ensure the user's
local binary directory is on `PATH`, then start a new shell or update `PATH`
before continuing.

## 3. Sign in with OpenRouter OAuth

Run:

```sh
ori login
```

Ori opens the user's browser for OAuth sign-in with their existing OpenRouter
account and stores the resulting credential for the CLI. The user does not
need to create, copy, or paste an API key. If a browser cannot open, use
`ori login --no-browser` and give the user the printed URL.

Do not ask the user to paste a key when OAuth is available. An explicitly
exported `OPENROUTER_API_KEY` can still be used by Ori when the user already
has one, but it is not required for this setup.

## 4. Run the user's existing agent CLI

Ori runs the agent CLI already installed on the user's `PATH`. It does not
replace the user's agent or make them learn a new agent workflow. Supported
launch commands today are:

```sh
ori claude
ori codex
ori opencode
ori hermes
```

If the selected agent is missing, Ori prints the recommended install command
and documentation link for that agent. Follow that instruction, then rerun the
same `ori <harness>` command.

Pass the user's normal agent arguments after the Ori flags. Everything Ori does
not consume is forwarded to the agent unchanged. For example:

```sh
ori claude -p "Review the authentication changes"
ori codex --full-auto
ori opencode
```

## 5. Choose any OpenRouter model

Use `--model` with any valid OpenRouter model id:

```sh
ori claude --model claude-opus-latest
ori codex --model gpt-5.2
ori hermes --model gemini-3-pro
```

The model value is routed through OpenRouter. Keep the user's existing agent
arguments after the Ori flags.

## 6. Upgrade Ori

Upgrade an installed release with:

```sh
ori update
```

Then verify the active version again:

```sh
ori --version
```

Do not use `ori update` from a source checkout as a substitute for installing
the released CLI.

## 7. Confirm the setup works

After sign-in, run the selected agent with a harmless prompt that proves the
request reaches OpenRouter:

```sh
ori claude --model openrouter/auto -p "Reply with exactly: Ori is connected"
```

Use the equivalent `ori codex`, `ori opencode`, or `ori hermes` command if the
user chose another agent. Confirm that the agent starts, the prompt completes,
and the response is returned. If the agent is missing, authentication fails,
or the model id is rejected, report the exact command output and fix that
specific setup issue before claiming the install worked.
