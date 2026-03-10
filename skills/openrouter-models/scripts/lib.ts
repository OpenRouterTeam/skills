import { OpenRouter } from '@openrouter/sdk';
import type { Model } from '@openrouter/sdk/models';
import type { FormattedModel } from './types.js';

export function requireApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error(
      'Error: OPENROUTER_API_KEY environment variable is not set.\n' +
        'Get your API key at https://openrouter.ai/keys',
    );
    process.exit(1);
  }
  return apiKey;
}

export function optionalApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY;
}

export function createClient(apiKey?: string): OpenRouter {
  return new OpenRouter({
    apiKey: apiKey ?? '',
  });
}

export function formatModel(m: Model): FormattedModel {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    created: m.created,
    context_length: m.contextLength,
    pricing: {
      prompt: m.pricing.prompt,
      completion: m.pricing.completion,
      ...(m.pricing.request !== undefined
        ? {
            request: m.pricing.request,
          }
        : {}),
      ...(m.pricing.image !== undefined
        ? {
            image: m.pricing.image,
          }
        : {}),
      ...(m.pricing.inputCacheRead !== undefined
        ? {
            input_cache_read: m.pricing.inputCacheRead,
          }
        : {}),
      ...(m.pricing.inputCacheWrite !== undefined
        ? {
            input_cache_write: m.pricing.inputCacheWrite,
          }
        : {}),
      ...(m.pricing.discount !== undefined
        ? {
            discount: m.pricing.discount,
          }
        : {}),
    },
    architecture: {
      tokenizer: m.architecture.tokenizer ?? null,
      modality: m.architecture.modality,
      input_modalities: m.architecture.inputModalities.map(String),
      output_modalities: m.architecture.outputModalities.map(String),
    },
    top_provider: {
      context_length: m.topProvider.contextLength ?? null,
      max_completion_tokens: m.topProvider.maxCompletionTokens ?? null,
      is_moderated: m.topProvider.isModerated,
    },
    per_request_limits: m.perRequestLimits
      ? {
          prompt_tokens: m.perRequestLimits.promptTokens,
          completion_tokens: m.perRequestLimits.completionTokens,
        }
      : null,
    supported_parameters: m.supportedParameters.map(String),
    ...(m.expirationDate
      ? {
          expiration_date: m.expirationDate,
        }
      : {}),
  };
}

export function parseArgs(argv: string[]): Map<string, string | true> {
  const result = new Map<string, string | true>();
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const current = argv[i];
    const next = argv[i + 1];
    if (current.startsWith('--') && next && !next.startsWith('--')) {
      result.set(current.slice(2), next);
      i++;
    } else if (current.startsWith('--')) {
      result.set(current.slice(2), true);
    } else {
      positional.push(current);
    }
  }

  for (let j = 0; j < positional.length; j++) {
    result.set(`_${j}`, positional[j]);
  }
  result.set('_count', String(positional.length));
  return result;
}
