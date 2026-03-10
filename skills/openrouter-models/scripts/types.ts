import type { Model, PublicEndpoint } from '@openrouter/sdk/models';

// Re-export SDK types for convenience
export type { Model, PublicEndpoint };

// Output format types (snake_case, matching current JSON output)
export interface FormattedModel {
  id: string;
  name: string;
  description: string | undefined;
  created: number;
  context_length: number | null;
  pricing: {
    prompt: string;
    completion: string;
    request?: string;
    image?: string;
    input_cache_read?: string;
    input_cache_write?: string;
    discount?: number;
  };
  architecture: {
    tokenizer?: string | null;
    modality: string | null;
    input_modalities: string[];
    output_modalities: string[];
  };
  top_provider: {
    context_length?: number | null;
    max_completion_tokens?: number | null;
    is_moderated: boolean;
  };
  per_request_limits: {
    prompt_tokens: number;
    completion_tokens: number;
  } | null;
  supported_parameters: string[];
  expiration_date?: string | null;
}
